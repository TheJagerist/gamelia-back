// Informations générales du site, figées au moment du build.
import { MOCK } from './api';

/** Adresse de contact de l'équipe (questions, mot de passe perdu, données personnelles). */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || (MOCK ? 'equipe@demo.gamelia' : '');

/** Date de la dernière mise à jour des pages légales. */
export const LEGAL_UPDATED = '12 novembre 2026';
