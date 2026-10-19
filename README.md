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
