export type ProjectionTheme = 'dark' | 'blue' | 'warm';
export type AppearanceTheme = 'dark' | 'light';
export type Density = 'normal' | 'compact';
export interface AppPreferences {
  language: 'pt-BR';
  appearance: AppearanceTheme;
  density: Density;
  confirmDelete: boolean;
  confirmImport: boolean;
  monitor: string;
  projectionTheme: ProjectionTheme;
  startHidden: boolean;
}
export interface DisplayDevice {
  id: number;
  name: string;
  primary: boolean;
  width: number;
  height: number;
}
export const DEFAULT_PREFERENCES: AppPreferences = {
  language: 'pt-BR',
  appearance: 'dark',
  density: 'normal',
  confirmDelete: true,
  confirmImport: true,
  monitor: 'auto',
  projectionTheme: 'dark',
  startHidden: false,
};
const STORAGE_KEY = 'nosso-culto-preferences-v1';
export function loadPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {...DEFAULT_PREFERENCES};
    const v: Partial<AppPreferences> = JSON.parse(raw);
    return {
      language: 'pt-BR',
      appearance: v.appearance === 'light' ? 'light' : 'dark',
      density: v.density === 'compact' ? 'compact' : 'normal',
      confirmDelete: typeof v.confirmDelete === 'boolean' ? v.confirmDelete : true,
      confirmImport: typeof v.confirmImport === 'boolean' ? v.confirmImport : true,
      monitor: typeof v.monitor === 'string' ? v.monitor : 'auto',
      projectionTheme: v.projectionTheme === 'blue' || v.projectionTheme === 'warm' ? v.projectionTheme : 'dark',
      startHidden: v.startHidden === true,
    };
  } catch { return {...DEFAULT_PREFERENCES}; }
}
export function savePreferences(prefs: AppPreferences): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); }
  catch (error) { console.warn('Não foi possível salvar as configurações', error); }
}
