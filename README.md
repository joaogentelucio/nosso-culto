# Nosso Culto — Electron + React

Aplicativo desktop Windows para projeção em cultos, desenvolvido com **Electron, React, TypeScript e Vite**. Não usa Tauri, Rust nem React Native Windows.

## Requisitos

- Windows 10/11 e Node.js 22 ou superior (com npm).
- Para compilar o instalador, execute os comandos em Windows ou use o workflow do GitHub Actions.

## Iniciar desenvolvimento

```powershell
npm install
npm run dev
```

Abre a janela desktop do Electron. Para testar a interface isolada no navegador: `npm run dev:web`.

## Criar o instalador

```powershell
npm run dist:win
```

O instalador NSIS fica em `release/`. No GitHub, abra **Actions → Build Windows (Electron)** e baixe o artefato da execução bem-sucedida. Esta versão ainda não possui assinatura de código; o SmartScreen pode exibir alerta de editor desconhecido.

## Funcionalidades

- Biblioteca de músicas e textos com criação, edição, exclusão e pesquisa.
- Divisão de letras em slides (separe com uma linha em branco).
- Programação do culto com reordenação dos itens.
- Segunda janela independente de projeção, posicionada automaticamente em um monitor externo, quando disponível.
- Seleção de monitor, exibição em tela cheia, tela preta, 3 temas e navegação por teclado.
- Armazenamento offline em arquivo JSON no diretório do usuário do Electron, e importação/exportação de backups.

## Projeção

Conecte um segundo monitor ou projetor e configure o Windows para **Estender**. Selecione o monitor no painel e clique em **Abrir projetor**. A projeção será aberta em uma janela independente. Para alterar slides, opere pelo painel principal; as alterações são enviadas via IPC para a janela de projeção.

## Escopo desta versão

Não há banco SQLite, Bíblia licenciada, vídeo de fundo, músicas importadas de outras soluções ou integração com streaming. Projeto independente, não afiliado ao Holyrics. A arquitetura Electron renderiza a interface web via Chromium dentro de janelas desktop; não é React Native Windows nem UI WinUI nativa.


## Configuração de três monitores

Em **Arquivo → Configuração → Projeção**, configure as funções:

- **Monitor Principal:** janela de controle. Padrão: monitor principal do Windows.
- **Monitor Secundário:** projeção pública independente. Padrão: primeiro monitor livre.
- **Monitor de Apoio:** saída adicional de slides para equipe/palco. Padrão: desativado.

Cada função possui escolha de monitor físico e **resolução da janela**.
**Nativa / tela inteira** utiliza toda a área do monitor; uma resolução menor cria
uma janela sem moldura, centralizada e dimensionada conforme a escala/DPI do Windows.
O aplicativo **não altera a resolução física do sistema operacional**.

O mesmo monitor não pode estar atribuído simultaneamente a duas funções. Configurações
de monitores desconectados ou duplicados são rejeitadas. A escolha do monitor principal
move e ajusta a janela de controle. Ao abrir o projetor, a janela secundária e, se
habilitada, a janela de apoio abrem em seus monitores, sincronizadas com os slides.
Por enquanto, o monitor de apoio espelha a letra projetada (não mostra o próximo slide).

Se o programa só detectar um monitor, conecte uma segunda tela e configure o Windows
em **Estender estes vídeos**. Alterações são persistidas localmente em preferências
do aplicativo, mantendo as instalações existentes e migrando a antiga escolha do
monitor de projeção para a nova função **Monitor Secundário**.

## Músicas: arquivos, pastas, ZIP e letras sincronizadas

Na página **Músicas → Conteúdos**, use **Arquivos** (seleção múltipla), **Pasta**
(importação recursiva) ou **ZIP** (descompactação controlada). Formatos aceitos:
MP3, WAV, FLAC, M4A, AAC, OGG, OPUS (a capacidade de decodificação depende do Chromium).
Arquivos importados são copiados para o diretório local do usuário do Electron;
não precisam continuar na pasta original. Limites por arquivo: 120 MB;
ZIP até 256 MB comprimido, 750 MB descompactado, no máximo 1500 entradas.

Selecione ou **arraste** uma música de Conteúdos para Edição & Apresentação.
O áudio é reproduzido **somente na janela principal de controle** (saída de som
padrão do Windows); os monitores de projeção/apoio recebem **somente os slides**.
O player usa relógio do próprio áudio: trechos com marcação de tempo mudam
automaticamente conforme a reprodução, e o operador pode buscar a música,
pausar, avançar trechos e ajustar individualmente os segundos de entrada.

**A letra não pode ser extraída de forma confiável apenas importando MP3/WAV.**
O recurso de reconhecimento de voz/transcrição automática ainda **não** está
integrado. Quando existe um arquivo `.lrc` com o mesmo nome-base na seleção
ou dentro do ZIP, a letra e as marcações de tempo são importadas juntas.
É possível importar um LRC depois, pelo painel de apresentação; ou clicar
em **Editar letra** e colar a letra manualmente.

Após colar a letra, o aplicativo cria **tempos estimados** distribuídos pela
duração, ou use **Distribuir tempos** explicitamente. Esses tempos não refletem
necessariamente as sílabas cantadas. Para ajustar, reproduza a música e use
**Marcar agora** no início de cada trecho ou edite os segundos. As marcações
salvas são reutilizadas nas próximas apresentações. Preferencialmente use LRC
criado para aquela gravação.

**Backups:** a exportação JSON atual inclui metadados, letras e tempos,
mas **não incorpora os arquivos de áudio**. Para restaurar em outro computador,
importe novamente os áudios e associe as letras. Um pacote portátil completo
de backup com os arquivos de música fica para uma versão futura.


## Interface por cenas (estrutura principal)

O painel inferior agora é dividido em quatro áreas independentes e sem barra de rolagem global:

1. **Cenas:** crie, selecione, renomeie ou exclua cenas (por exemplo Louvor, Avisos, Pregação).
2. **Itens da cena:** adicione Música, Texto ou Bíblia à cena escolhida, reordene com as setas ou arraste os itens, e selecione qual editar.
3. **Edição & Pré-visualização:** o painel central muda de acordo com o tipo do item. Música abre a biblioteca de áudios, importação, player e editor de letras temporizadas; Texto e Bíblia abrem um editor manual com slides.
4. **Saída de vídeo:** prévia e controles do projetor, em uma janela Electron separada quando disponível.

Criar uma cena **não** cria automaticamente suas músicas: adicione primeiro um **item do tipo Música** à cena e selecione/importa a gravação dentro do editor correspondente. A música escolhida fica vinculada ao item daquela cena. Um mesmo áudio pode ser vinculado a diversos itens e cenas, sem duplicar o arquivo.

**Compatibilidade:** na primeira atualização, a antiga lista de programação é preservada na cena **Programação anterior**, enquanto a nova cena **Louvor** serve de ponto de partida. Os dados persistem no mesmo JSON do Electron; exportação e importação de backup agora também incluem as cenas e seus itens (mas ainda não incorporam os arquivos MP3/WAV). A seção Bíblia suporta inclusão manual de versículos, sem traduções licenciadas embutidas.

Para usar a interface por cenas com arquivos locais e múltiplos monitores, execute com `npm run dev` no Electron, não somente `npm run dev:web`.


## Abrir projeção de texto e Bíblia

1. Selecione uma cena e um item Texto ou Bíblia, depois **digite o conteúdo real** no editor. O exemplo cinza dentro do campo não faz parte do slide.
2. Clique em **Abrir janela de projeção** (navegador) ou **Abrir projetor** (Electron): o primeiro slide do item selecionado é enviado automaticamente.
3. Os botões **Projetar primeiro slide**, **Projetar item selecionado** e os cartões de slide permitem reenviar ou trocar o conteúdo ao vivo.
4. No Chrome, uma nova janela não pode entrar em modo totalmente fullscreen sem nova interação: clique em **Entrar em tela cheia** dentro da janela de projeção, ou use F11. No Electron, a janela abre em fullscreen no monitor escolhido.
5. Caso não haja texto ou letra preparada, a janela explica que **nenhum conteúdo está pronto**. **Ocultar** continua exibindo fundo totalmente preto, intencionalmente.

A comunicação entre janelas web usa localStorage para recuperar o último slide e BroadcastChannel para eventos em tempo real. No Electron, a janela recebe o estado por IPC, mantendo o mesmo comportamento.

## Layout compacto e exibição automática por cenas

A barra superior com logo/título e botões de Importar, Backup e Projetor foi **removida** para deixar os quatro painéis utilizarem 100% da altura útil abaixo de **Arquivo / Editar / Ferramentas**. Backup, importação e ferramentas continuam acessíveis pelo menu **Arquivo**.

- **O primeiro item de cada cena é o principal (posição 1)**. É ele que o programa seleciona e prepara automaticamente quando você entra naquela cena.
- Cada item exibe a posição numérica, a função **Principal** ou **Secundário** e pode ser arrastado para cima/baixo. O drop distingue a metade superior/inferior do destino; as setas ainda funcionam como alternativa.
- Ao reordenar, a seleção volta automaticamente ao novo item da posição 1. Selecionar manualmente um item secundário mostra seu conteúdo, mas **não altera sua posição**.
- Ao selecionar um item com texto ou letra, a prévia e a saída em janela separada são atualizadas automaticamente; **não é mais necessário clicar em “Projetar primeiro slide” ou “Projetar item selecionado”**. Os cartões de versos continuam permitindo avançar para outros trechos, sem mudar a classificação de prioridade.
- **Ocultar / Mostrar** ainda funcionam: durante uma ocultação intencional, a troca de itens atualiza o slide preparado, mas mantém a tela preta até o operador clicar em **Mostrar**.
- O botão **Abrir janela de projeção** permanece no painel Saída de vídeo porque o navegador exige uma ação do usuário para abrir uma janela nova. No Electron, a mesma ação abre a janela externa no monitor configurado.

As alterações de ordem e cenas são salvas automaticamente.
