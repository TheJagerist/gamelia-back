const env = require('./config/env'); // chargé en premier : échoue vite si mal configuré
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { attachSession, checkCsrf } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const { questionsRouter, commentsRouter, votesRouter } = require('./routes/questions');
const { tracksRouter, lessonsRouter } = require('./routes/learn');
const challengesRouter = require('./routes/challenges');
const adminRouter = require('./routes/admin');
const projectsRouter = require('./routes/projects');
const recruiterRouter = require('./routes/recruiter');
const opportunitiesRouter = require('./routes/opportunities');
const meRouter = require('./routes/me');
const reportsRouter = require('./routes/reports');
const notificationsRouter = require('./routes/notifications');
const { meProgressRouter, profilesRouter, classementRouter } = require('./routes/progress');
const filRouter = require('./routes/fil');
const homeRouter = require('./routes/home');
const messagesRouter = require('./routes/messages');
const agnesRouter = require('./routes/agnes');
const { query } = require('./db/pool');

const app = express();

// L'API est derrière nginx (un seul proxy) : nécessaire pour que req.ip soit l'adresse du visiteur
// (limites de débit par personne) et non celle de nginx.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.frontOrigin, // jamais '*' : incompatible avec credentials:true
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(env.cookieSecret)); // le secret sert aux cookies signés (connexion avec GitHub)

// Limite les tentatives sur les routes sensibles (cahier des charges, section 7).
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives. Patientez une minute avant de réessayer.' },
  // Seules les tentatives sensibles sont comptées (connexion, inscription, mot de passe oublié).
  // GET /auth/me est appelé à chaque chargement de page : le limiter déconnecterait les membres
  // qui naviguent vite, et tous ceux qui partagent une même adresse IP (cybercafé, campus, réseau mobile).
  skip: (req) => req.method === 'GET' || req.path === '/deconnexion',
});

app.use(attachSession); // remplit req.user si un cookie de session valide existe
app.use(checkCsrf); // vérifie X-CSRF-Token sur toute requête mutante d'un user connecté

app.use('/auth', authLimiter, authRoutes);
app.use('/questions', questionsRouter);
app.use('/reponses', commentsRouter);
app.use('/votes', votesRouter);
app.use('/pistes', tracksRouter);
app.use('/lecons', lessonsRouter);
app.use('/defis', challengesRouter);
app.use('/admin', adminRouter);
app.use('/projets', projectsRouter);
app.use('/recruteur', recruiterRouter);
app.use('/defis-recruteurs', opportunitiesRouter);
app.use('/moi', meRouter);
app.use('/moi', meProgressRouter); // /moi/progression, /moi/portfolio
app.use('/signalements', reportsRouter);
app.use('/notifications', notificationsRouter);
app.use('/classement', classementRouter);
app.use('/profils', profilesRouter);
app.use('/fil', filRouter);
app.use('/accueil', homeRouter);
app.use('/messages', messagesRouter);
app.use('/agnes', agnesRouter);

// Contrôle de santé pour le déploiement : vérifie que l'API répond ET que PostgreSQL est joignable.
app.get('/sante', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, database: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[sante] base de données injoignable :', err.message);
    res.status(503).json({ ok: false, database: false, message: 'La base de données est injoignable.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: "Ce contenu n'existe pas ou a été supprimé." });
});

app.use(errorHandler); // doit rester le dernier app.use()

const server = app.listen(env.port, env.host, () => {
  // eslint-disable-next-line no-console
  console.log(`[gamelia-back] démarré sur le port ${env.port} (${env.nodeEnv})`);
});

// Purge des sessions expirées (au démarrage puis toutes les heures) : sans cela la table grossit sans fin.
const purgeSessions = () =>
  query('DELETE FROM sessions WHERE expires_at < now()').catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[sessions] purge impossible :', err.message);
  });
purgeSessions();
setInterval(purgeSessions, 60 * 60 * 1000).unref();

// Arrêt propre (systemd envoie SIGTERM) : on finit les requêtes en cours puis on ferme le pool PostgreSQL.
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`[gamelia-back] ${signal} reçu, arrêt en cours…`);
  server.close(() => {
    require('./db/pool').pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref(); // garde-fou si une connexion reste ouverte
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
