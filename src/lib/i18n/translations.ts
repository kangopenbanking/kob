export const translations = {
  en: {
    // Navigation
    home: "Home",
    about: "About",
    developer: "Developer",
    contact: "Contact",
    dashboard: "Dashboard",
    admin: "Admin",
    fiPortal: "FI Portal",
    signIn: "Sign In",
    signOut: "Sign Out",
    
    // Hero
    heroTitle: "Unified Banking API for Cameroon",
    heroSubtitle: "Connect to multiple banks with a single, secure API. Purpose-built for Cameroon's financial ecosystem with full XAF support.",
    getStarted: "Get Started",
    viewDocs: "View Documentation",
    
    // Features
    features: "Features",
    forBanks: "For Banks",
    forDevelopers: "For Developers",
    compliance: "Compliance",
    security: "Security",
    
    // API
    apiDocumentation: "API Documentation",
    authentication: "Authentication",
    endpoints: "Endpoints",
    examples: "Examples",
    
    // Admin
    adminPanel: "Admin Panel",
    clients: "Clients",
    users: "Users",
    audit: "Audit Logs",
    metrics: "Metrics",
    reports: "Reports",
    
    // FI Portal
    fiDashboard: "FI Dashboard",
    transactions: "Transactions",
    analytics: "Analytics",
    apiUsage: "API Usage",
    accounts: "Accounts",
    
    // Common
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    search: "Search",
    filter: "Filter",
    export: "Export",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    
    // Footer
    footerTagline: "Powering the future of banking in Cameroon",
    quickLinks: "Quick Links",
    legal: "Legal",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    cookies: "Cookie Policy",
  },
  fr: {
    // Navigation
    home: "Accueil",
    about: "À propos",
    developer: "Développeur",
    contact: "Contact",
    dashboard: "Tableau de bord",
    admin: "Administration",
    fiPortal: "Portail IF",
    signIn: "Se connecter",
    signOut: "Se déconnecter",
    
    // Hero
    heroTitle: "API Bancaire Unifiée pour le Cameroun",
    heroSubtitle: "Connectez-vous à plusieurs banques avec une seule API sécurisée. Conçue pour l'écosystème financier du Cameroun avec support complet XAF.",
    getStarted: "Commencer",
    viewDocs: "Voir la Documentation",
    
    // Features
    features: "Fonctionnalités",
    forBanks: "Pour les Banques",
    forDevelopers: "Pour les Développeurs",
    compliance: "Conformité",
    security: "Sécurité",
    
    // API
    apiDocumentation: "Documentation API",
    authentication: "Authentification",
    endpoints: "Points de terminaison",
    examples: "Exemples",
    
    // Admin
    adminPanel: "Panneau d'Administration",
    clients: "Clients",
    users: "Utilisateurs",
    audit: "Journaux d'Audit",
    metrics: "Métriques",
    reports: "Rapports",
    
    // FI Portal
    fiDashboard: "Tableau de Bord IF",
    transactions: "Transactions",
    analytics: "Analytique",
    apiUsage: "Utilisation API",
    accounts: "Comptes",
    
    // Common
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    create: "Créer",
    search: "Rechercher",
    filter: "Filtrer",
    export: "Exporter",
    loading: "Chargement...",
    error: "Erreur",
    success: "Succès",
    
    // Footer
    footerTagline: "Propulsant l'avenir de la banque au Cameroun",
    quickLinks: "Liens Rapides",
    legal: "Mentions Légales",
    privacy: "Politique de Confidentialité",
    terms: "Conditions d'Utilisation",
    cookies: "Politique des Cookies",
  }
} as const;

export type Language = 'en' | 'fr';
export type TranslationKey = keyof typeof translations.en;
