import {useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {BookOpen, Download, FilePlus2, FolderOpen, Keyboard, LayoutPanelLeft, Monitor, MonitorPlay, Moon, Palette, Power, Settings2, SlidersHorizontal, Sun, Trash2, X} from 'lucide-react';
import type {AppPreferences, DisplayDevice, ProjectionTheme} from './preferences';
import {DEFAULT_PREFERENCES, availableResolutions, resolveMonitors, sanitizeMonitors} from './preferences';
import type {DisplayRole} from './preferences';
import './desktop-menu.css';
import './display-settings.css';

type MenuName = 'file' | 'edit' | 'tools';
type Section = 'general' | 'appearance' | 'projection' | 'shortcuts' | 'advanced';
type MenuAction = {label: string; icon: ReactNode; action: () => void; disabled?: boolean; separated?: boolean};
interface Props {
  preferences: AppPreferences;
  displays: DisplayDevice[];
  hasSelected: boolean;
  onApply: (preferences: AppPreferences) => Promise<void>;
  onNew: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddQueue: () => void;
  onOpenProjection: () => void;
  onHideProjection: () => void;
  onShowProjection: () => void;
  onImport: () => void;
  onExport: () => void;
  onExit: () => void;
}
const sidebar: Array<{id: Section; label: string; icon: ReactNode}> = [
  {id:'general', label:'Geral', icon:<Settings2 size={17}/>},
  {id:'appearance', label:'Aparência', icon:<Palette size={17}/>},
  {id:'projection', label:'Projeção', icon:<Monitor size={17}/>},
  {id:'shortcuts', label:'Teclas de atalho', icon:<Keyboard size={17}/>},
  {id:'advanced', label:'Avançado', icon:<SlidersHorizontal size={17}/>},
];
export default function DesktopToolbar(props: Props) {
  const [menu, setMenu] = useState<MenuName|null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<Section>('general');
  const [draft, setDraft] = useState<AppPreferences>(props.preferences);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(draft)!==JSON.stringify(props.preferences);
  function setField<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) {
    setDraft(old => ({...old,[key]:value}));
  }
  useEffect(() => {
    if (menu===null) return;
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key==='Escape') {event.stopPropagation();setMenu(null);}
    };
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',esc,true);
    return () => {document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',esc,true);};
  },[menu]);
  useEffect(() => {
    if (!settingsOpen) return;
    const esc = (event: KeyboardEvent) => {
      if (event.key==='Escape') {event.stopImmediatePropagation();event.preventDefault();setSettingsOpen(false);}
    };
    document.addEventListener('keydown',esc,true);
    const previous = document.activeElement as HTMLElement|null;
    dialogRef.current?.focus();
    return () => {document.removeEventListener('keydown',esc,true);previous?.focus();};
  },[settingsOpen]);
  function openSettings() {
    setMenu(null);
    setDraft({...props.preferences});
    setError('');
    setSection('general');
    setSettingsOpen(true);
  }
  function run(callback: () => void) {setMenu(null);callback();}
  const resolved = resolveMonitors(draft.monitors,props.displays);
  const roles: DisplayRole[] = ['main','secondary','support'];
  const invalidSelection = roles.find(role => {
    const id = draft.monitors[role].monitorId;
    return id !== 'off' && id !== 'auto' && !resolved[role];
  });
  const invalidMessage = invalidSelection
    ? 'O monitor selecionado para '+({main:'Principal',secondary:'Secundário',support:'Apoio'}[invalidSelection])+
      ' não está disponível ou já está atribuído a outra saída.'
    : '';
  async function apply(): Promise<boolean> {
    if (invalidMessage) {setError(invalidMessage);return false;}
    setSaving(true);setError('');
    try {await props.onApply({...draft});return true;}
    catch(e) {setError(String(e instanceof Error ? e.message : e));return false;}
    finally {setSaving(false);}
  }
  async function confirm() {if (await apply()) setSettingsOpen(false);}
  function setMonitor(role: DisplayRole, field:'monitorId'|'resolution', value:string) {
    setError('');
    setDraft(old=>({...old,monitors:{
      ...old.monitors,[role]:{
        ...old.monitors[role],[field]:value,
        ...(field==='monitorId'?{resolution:'native'}:{}),
      },
    }}));
  }
  const actions: Record<MenuName, MenuAction[]> = {
    file:[
      {label:'Configuração',icon:<Settings2 size={17}/>,action:openSettings},
      {label:'Importar backup',icon:<FolderOpen size={17}/>,action:props.onImport,disabled:!window.desktop,separated:true},
      {label:'Exportar backup',icon:<Download size={17}/>,action:props.onExport,disabled:!window.desktop},
      {label:'Sair do Nosso Culto',icon:<Power size={17}/>,action:props.onExit,disabled:!window.desktop,separated:true},
    ],
    edit:[
      {label:'Novo conteúdo',icon:<FilePlus2 size={17}/>,action:props.onNew},
      {label:'Editar conteúdo selecionado',icon:<BookOpen size={17}/>,action:props.onEdit,disabled:!props.hasSelected},
      {label:'Excluir conteúdo selecionado',icon:<Trash2 size={17}/>,action:props.onDelete,disabled:!props.hasSelected},
      {label:'Adicionar à programação',icon:<LayoutPanelLeft size={17}/>,action:props.onAddQueue,disabled:!props.hasSelected,separated:true},
    ],
    tools:[
      {label:'Abrir projetor',icon:<MonitorPlay size={17}/>,action:props.onOpenProjection},
      {label:'Ocultar projeção',icon:<Moon size={17}/>,action:props.onHideProjection,separated:true},
      {label:'Mostrar projeção',icon:<Sun size={17}/>,action:props.onShowProjection},
    ],
  };
  return <>
    <div className="desktop-menubar" role="menubar" aria-label="Menu principal" ref={menuRef}>
      {([
        ['file','Arquivo'],['edit','Editar'],['tools','Ferramentas'],
      ] as Array<[MenuName,string]>).map(([key,label])=>
        <div className="desktop-menu-group" key={key}>
          <button type="button" role="menuitem" aria-haspopup="true" aria-expanded={menu===key}
            className={'desktop-menu-trigger '+(menu===key?'is-open':'')}
            onClick={()=>setMenu(m=>m===key?null:key)}>{label}</button>
          {menu===key&&<div className="desktop-dropdown" role="menu" aria-label={label}>
            {actions[key].map(a=><div key={a.label}>
              {a.separated&&<div className="desktop-dropdown-separator"/>}
              <button type="button" role="menuitem" className="desktop-dropdown-item" disabled={a.disabled} onClick={()=>run(a.action)}>
                {a.icon}<span>{a.label}</span>
              </button>
            </div>)}
          </div>}
        </div>
      )}
    </div>
    {settingsOpen&&
      <div className="nc-settings-overlay" data-settings-open="true" onMouseDown={event=>{if(event.target===event.currentTarget)setSettingsOpen(false);}}>
        <div className="nc-settings-modal" role="dialog" aria-modal="true" aria-label="Configurações" tabIndex={-1} ref={dialogRef}>
          <header className="nc-settings-header">
            <div className="nc-settings-header-title"><Settings2 size={19}/><span>Configurações</span></div>
            <button aria-label="Fechar configurações" title="Fechar" className="nc-icon-button" onClick={()=>setSettingsOpen(false)}><X size={19}/></button>
          </header>
          <div className="nc-settings-body">
            <aside className="nc-settings-sidebar" aria-label="Categorias das configurações">
              {sidebar.map(s=><button type="button" key={s.id} onClick={()=>setSection(s.id)}
                className={'nc-settings-tab '+(section===s.id?'active':'')} aria-current={section===s.id?'page':undefined}>
                {s.icon}<span>{s.label}</span>
              </button>)}
            </aside>
            <div className="nc-settings-content">
              {section==='general'&&<>
                <div className="nc-settings-card">
                  <h3>Geral</h3>
                  <div className="nc-settings-field">
                    <label htmlFor="nc-language">Idioma</label>
                    <select id="nc-language" value={draft.language} disabled><option value="pt-BR">Português brasileiro</option></select>
                  </div>
                  <p className="nc-settings-help">Outros idiomas serão adicionados em versões futuras.</p>
                </div>
                <div className="nc-settings-card">
                  <h3>Confirmações</h3>
                  <label className="nc-settings-check"><input type="checkbox" checked={draft.confirmDelete} onChange={e=>setField('confirmDelete',e.target.checked)}/><span>Perguntar antes de excluir conteúdos</span></label>
                  <label className="nc-settings-check"><input type="checkbox" checked={draft.confirmImport} onChange={e=>setField('confirmImport',e.target.checked)}/><span>Perguntar antes de substituir dados ao importar backup</span></label>
                </div>
              </>}
              {section==='appearance'&&<>
                <div className="nc-settings-card">
                  <h3>Aparência</h3>
                  <div className="nc-settings-field">
                    <label htmlFor="nc-appearance">Tema da interface</label>
                    <select id="nc-appearance" value={draft.appearance} onChange={e=>setField('appearance',e.target.value as AppPreferences['appearance'])}>
                      <option value="dark">Escuro (padrão)</option><option value="light">Claro</option>
                    </select>
                  </div>
                  <div className="nc-settings-field">
                    <label htmlFor="nc-density">Densidade dos componentes</label>
                    <select id="nc-density" value={draft.density} onChange={e=>setField('density',e.target.value as AppPreferences['density'])}>
                      <option value="normal">Normal</option><option value="compact">Compacta</option>
                    </select>
                  </div>
                </div>
              </>}
              {section==='projection'&&<>
                <div className="nc-settings-card">
                  <div className="nc-display-heading"><h3>Configuração de exibição</h3><span>{props.displays.length} monitor(es) detectado(s)</span></div>
                  {([
                    {role:'main',title:'Monitor Principal',description:'Janela de controle do Nosso Culto.',badge:'CONTROLE'},
                    {role:'secondary',title:'Monitor Secundário',description:'Saída de projeção para o público.',badge:'PROJEÇÃO'},
                    {role:'support',title:'Monitor de Apoio',description:'Saída adicional para a equipe ou palco.',badge:'APOIO'},
                  ] as Array<{role:DisplayRole;title:string;description:string;badge:string}>).map(group=>{
                    const assignment=draft.monitors[group.role];
                    const activeDisplay=resolved[group.role];
                    const scale=activeDisplay?.scaleFactor??1;
                    const nativeSize=activeDisplay
                      ? Math.round(activeDisplay.width*scale)+' × '+Math.round(activeDisplay.height*scale) : 'Não disponível';
                    const options=availableResolutions(activeDisplay);
                    const unavailable=assignment.resolution!=='native'&&!options.includes(assignment.resolution);
                    return <div className="nc-display-role" key={group.role}>
                      <div className="nc-display-role-heading">
                        <span className="nc-display-role-icon"><Monitor size={18}/></span>
                        <div><h4>{group.title}</h4><p>{group.description}</p></div>
                        <span className="nc-display-role-badge">{group.badge}</span>
                      </div>
                      <div className="nc-display-row">
                        <label htmlFor={'nc-monitor-'+group.role}>Monitor</label>
                        <select id={'nc-monitor-'+group.role} value={assignment.monitorId}
                          onChange={e=>setMonitor(group.role,'monitorId',e.target.value)}>
                          {group.role==='main'
                            ? <option value="primary">Principal do Windows (automático)</option>
                            : <>
                                <option value="auto">Automático (próximo disponível)</option>
                                <option value="off">Não utilizar</option>
                              </>}
                          {props.displays.map(d=><option key={d.id} value={String(d.id)}>
                            {d.name} — {Math.round(d.width*(d.scaleFactor??1))} × {Math.round(d.height*(d.scaleFactor??1))}
                            {d.primary?' (principal do Windows)':''}
                          </option>)}
                        </select>
                      </div>
                      <div className="nc-display-row">
                        <label htmlFor={'nc-resolution-'+group.role}>Resolução da janela</label>
                        <select id={'nc-resolution-'+group.role} value={assignment.resolution}
                          disabled={!activeDisplay||assignment.monitorId==='off'}
                          onChange={e=>setMonitor(group.role,'resolution',e.target.value)}>
                          <option value="native">Nativa / tela inteira ({nativeSize})</option>
                          {unavailable&&<option value={assignment.resolution}>{assignment.resolution.replace('x',' × ')} (indisponível)</option>}
                          {options.filter(opt=>opt!=='native').map(size=><option key={size} value={size}>{size.replace('x',' × ')}</option>)}
                        </select>
                      </div>
                      {!activeDisplay&&assignment.monitorId!=='off'&&
                        <p className="nc-display-warning">Não há monitor disponível para esta saída. Verifique a conexão e as atribuições.</p>}
                    </div>;
                  })}
                  <p className="nc-settings-help">As resoluções ajustam o tamanho da janela exibida em cada monitor; não modificam a resolução configurada no Windows. Use “Estender estes vídeos” nas configurações do Windows.</p>
                </div>
                <div className="nc-settings-card">
                  <h3>Preferências da projeção</h3>
                  <div className="nc-settings-field">
                    <label htmlFor="nc-project-theme">Fundo padrão dos slides</label>
                    <select id="nc-project-theme" value={draft.projectionTheme} onChange={e=>setField('projectionTheme',e.target.value as ProjectionTheme)}>
                      <option value="dark">Preto</option><option value="blue">Azul</option><option value="warm">Quente</option>
                    </select>
                  </div>
                  <label className="nc-settings-check"><input type="checkbox" checked={draft.startHidden} onChange={e=>setField('startHidden',e.target.checked)}/><span>Ocultar conteúdo ao abrir a projeção</span></label>
                </div>
              </>}
              {section==='shortcuts'&&<>
                <div className="nc-settings-card">
                  <h3>Teclas de atalho</h3>
                  <p className="nc-settings-help">Atalhos disponíveis na janela de controle, fora de campos de texto.</p>
                  {[
                    ['Próximo slide','→ / ↓ / Page Down / Espaço'],
                    ['Slide anterior','← / ↑ / Page Up'],
                    ['Ocultar projeção','Esc'],
                  ].map(([name,key])=><div className="nc-settings-hotkey" key={name}><span>{name}</span><kbd>{key}</kbd></div>)}
                </div>
              </>}
              {section==='advanced'&&<>
                <div className="nc-settings-card">
                  <h3>Avançado</h3>
                  <p className="nc-settings-help">Exporte ou importe uma cópia local da biblioteca e da programação.</p>
                  <div className="nc-settings-button-row">
                    <button type="button" disabled={!window.desktop} onClick={()=>run(props.onExport)}><Download size={16}/> Exportar backup</button>
                    <button type="button" disabled={!window.desktop} onClick={()=>run(props.onImport)}><FolderOpen size={16}/> Importar backup</button>
                  </div>
                </div>
                <div className="nc-settings-card">
                  <h3>Restaurar configurações</h3>
                  <p className="nc-settings-help">Restaura as preferências do aplicativo. Músicas, textos e programação não serão apagados.</p>
                  <button type="button" className="nc-settings-reset" onClick={()=>setDraft({...DEFAULT_PREFERENCES,monitors:sanitizeMonitors(null)})}>Restaurar padrões</button>
                </div>
              </>}
            </div>
          </div>
          <footer className="nc-settings-footer">
            <div className="nc-settings-feedback">
              {error||invalidMessage?<small className="nc-settings-error">{error||invalidMessage}</small>:dirty&&<small>Há alterações não aplicadas</small>}
            </div>
            <div className="nc-settings-footer-buttons">
              <button className="nc-settings-accept" disabled={saving||Boolean(invalidMessage)} onClick={()=>void confirm()}>OK</button>
              <button onClick={()=>setSettingsOpen(false)}>Cancelar</button>
              <button disabled={!dirty||saving||Boolean(invalidMessage)} onClick={()=>void apply()}>Aplicar</button>
            </div>
          </footer>
        </div>
      </div>}
  </>;
}
