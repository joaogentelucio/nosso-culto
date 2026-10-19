export type ProjectionTheme = 'dark' | 'blue' | 'warm';
export type AppearanceTheme = 'dark' | 'light';
export type Density = 'normal' | 'compact';
export type DisplayRole = 'main' | 'secondary' | 'support';
export type MonitorAssignment = { monitorId: string; resolution: string };
export type MonitorConfiguration = Record<DisplayRole, MonitorAssignment>;
export interface AppPreferences {
  language: 'pt-BR';
  appearance: AppearanceTheme;
  density: Density;
  confirmDelete: boolean;
  confirmImport: boolean;
  monitors: MonitorConfiguration;
  projectionTheme: ProjectionTheme;
  startHidden: boolean;
}
export interface DisplayDevice {
  id: number;
  name: string;
  primary: boolean;
  width: number;
  height: number;
  scaleFactor?: number;
}
export const DEFAULT_MONITORS: MonitorConfiguration = {
  main: {monitorId: 'primary', resolution: 'native'},
  secondary: {monitorId: 'auto', resolution: 'native'},
  support: {monitorId: 'off', resolution: 'native'},
};
export const DEFAULT_PREFERENCES: AppPreferences = {
  language: 'pt-BR', appearance: 'dark', density: 'normal',
  confirmDelete: true, confirmImport: true,
  monitors: DEFAULT_MONITORS,
  projectionTheme: 'dark', startHidden: false,
};
const STORAGE_KEY = 'nosso-culto-preferences-v1';

export function sanitizeMonitors(value: unknown, legacyMonitor?: unknown): MonitorConfiguration {
  const v = value && typeof value === 'object' ? value as Partial<MonitorConfiguration> : {};
  const validId = (id: unknown, fallback: string): string =>
    typeof id === 'string' && /^(primary|auto|off|\d+)$/.test(id) ? id : fallback;
  const validResolution = (resolution: unknown): string =>
    typeof resolution === 'string' && (resolution === 'native' || /^(\d{3,4})x(\d{3,4})$/.test(resolution))
      ? resolution : 'native';
  const legacySecondary = typeof legacyMonitor === 'string' && legacyMonitor !== 'auto'
    ? legacyMonitor : 'auto';
  return {
    main: {
      monitorId: validId(v.main?.monitorId, 'primary'),
      resolution: validResolution(v.main?.resolution),
    },
    secondary: {
      monitorId: validId(v.secondary?.monitorId, validId(legacySecondary, 'auto')),
      resolution: validResolution(v.secondary?.resolution),
    },
    support: {
      monitorId: validId(v.support?.monitorId, 'off'),
      resolution: validResolution(v.support?.resolution),
    },
  };
}
export function resolveMonitors(
  config: MonitorConfiguration, displays: DisplayDevice[]
): Record<DisplayRole, DisplayDevice | undefined> {
  const primary = displays.find(d => d.primary) ?? displays[0];
  const assigned = new Set<number>();
  function choose(id: string, isMain = false): DisplayDevice | undefined {
    if (id === 'off') return undefined;
    const found = id === 'primary' ? primary
      : id === 'auto'
        ? (isMain ? primary : displays.find(d => !assigned.has(d.id)))
        : displays.find(d => String(d.id) === id);
    if (!found || assigned.has(found.id)) return undefined;
    assigned.add(found.id);
    return found;
  }
  const main = choose(config.main.monitorId, true);
  const secondary = choose(config.secondary.monitorId);
  const support = choose(config.support.monitorId);
  return {main, secondary, support};
}
export function availableResolutions(display?: DisplayDevice): string[] {
  const catalog = [[3840,2160],[3440,1440],[2560,1440],[2560,1080],[1920,1200],
    [1920,1080],[1600,900],[1440,900],[1366,768],[1280,800],[1280,720],[1024,768]];
  if (!display) return ['native'];
  const scale = display.scaleFactor ?? 1;
  const w = Math.round(display.width * scale);
  const h = Math.round(display.height * scale);
  const result = ['native', ...catalog.filter(([x,y]) => x <= w && y <= h).map(([x,y]) => x+'x'+y)];
  return result;
}
export function loadPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {...DEFAULT_PREFERENCES,monitors:sanitizeMonitors(null)};
    const v: Partial<AppPreferences> & {monitor?: string} = JSON.parse(raw);
    return {
      language: 'pt-BR',
      appearance: v.appearance === 'light' ? 'light' : 'dark',
      density: v.density === 'compact' ? 'compact' : 'normal',
      confirmDelete: typeof v.confirmDelete === 'boolean' ? v.confirmDelete : true,
      confirmImport: typeof v.confirmImport === 'boolean' ? v.confirmImport : true,
      monitors: sanitizeMonitors(v.monitors,v.monitor),
      projectionTheme: v.projectionTheme === 'blue' || v.projectionTheme === 'warm'
        ? v.projectionTheme : 'dark',
      startHidden: v.startHidden === true,
    };
  } catch { return {...DEFAULT_PREFERENCES,monitors:sanitizeMonitors(null)}; }
}
export function savePreferences(prefs: AppPreferences): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); }
  catch (error) { console.warn('Não foi possível salvar as configurações', error); }
}
