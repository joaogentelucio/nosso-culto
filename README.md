# Nosso Culto — Electron + React

Aplicativo desktop Windows para projeção em cultos, desenvolvido com **Electron, React, TypeScript e Vite**. Não usa Tauri, Rust nem React Native Windows.

## Transcrever com um clique (versão desktop Windows)

O operador vê apenas **Transcrever**. O Nosso Culto escolhe automaticamente
entre dois caminhos, sem exibir opções de modelo, idioma, API ou parâmetros:

- **Sem letra:** reconhece o canto usando o modelo Whisper local e apresenta
  os trechos com tempos identificados no áudio.
- **Com letra:** preserva exatamente a letra existente e tenta alinhar seus
  versos com o reconhecimento do áudio, incluindo repetições quando detectadas.
  Uma correspondência insuficiente gera aviso em vez de fabricar horários.

O usuário pode cancelar enquanto processa. O modelo é baixado na primeira
execução, depois pode funcionar offline. Não há cobrança da API OpenAI.
A transcrição local requer o instalador Windows com whisper.cpp e FFmpeg.
Na versão web ainda não existe processamento Whisper integrado: é necessário
um motor no navegador ou infraestrutura de processamento para oferecer o
mesmo fluxo com segurança. Letras cantadas, backing vocals e coros podem
causar erros; confira a sincronização antes do culto.

**Estado do modelo:** são usados os pesos públicos originais do Whisper.
Este commit **não contém modelos treinados/fine-tuned pela equipe**.
Treinar um modelo especializado exige um conjunto autorizado de gravações,
letras revisadas e alinhamentos, além de GPU e avaliação contra um conjunto
de teste independente. A parte de treinamento é interna e não será exposta
aos usuários.
## Transcrição gratuita integrada — sem Python

A partir desta versão, **o instalador Windows inclui o whisper.cpp e o FFmpeg**.
Para o usuário, basta importar um áudio, escolher **Transcrever IA → Gratuito · Local**
e clicar em **Transcrever e sincronizar**. Não é necessário Python, terminal, instalar
bibliotecas ou cadastrar chave da OpenAI. O programa baixa os pesos do modelo
**apenas no primeiro uso**; depois pode funcionar offline.

Os modelos disponíveis são Tiny (mais leve), Base (padrão) e Small (mais detalhado).
O reconhecimento de músicas cantadas pode falhar: revise sempre a letra e os
tempos antes de projetar. Os arquivos de áudio não são enviados a um servidor
quando o modo local está selecionado.

Para desenvolvedores: no Windows, execute \`npm run prepare:transcription:win\`
antes de \`npm run dev\` para construir os binários nativos no diretório
\`build-tools/transcription/\` (exige CMake e ferramentas C++); o **instalador
gerado pelo GitHub Actions já inclui os executáveis**. O motor e o FFmpeg têm
licenças próprias; veja \`THIRD_PARTY.txt\` ao lado dos binários distribuídos.
Os modelos são obtidos via Hugging Face (ggml/whisper.cpp) na primeira execução.

O modo opcional **API OpenAI · Pago** continua disponível, sem qualquer
alternância automática do gratuito para o pago. A versão Web/Vercel não consegue
executar o programa nativo; esta solução é específica do Electron no Windows.

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

## Preparação e transmissão (monitor principal obrigatório)

- **Pré-visualização** no painel direito é privada e permite preparar músicas, textos, versículos ou imagens antes de transmitir.
- **Iniciar transmissão** e **Encerrar transmissão** controlam uma janela de saída distinta. O estado ao vivo só é publicado depois do início.
- **Regra permanente no Electron:** o destino da transmissão é sempre **Arquivo → Configuração → Projeção → Monitor Principal**, incluindo a resolução selecionada. Nunca são utilizadas seleções paralelas do painel direito, o monitor secundário ou outro destino como substituto.
- A posição da janela de controle é independente do Monitor Principal configurado. Um monitor desconectado resulta em erro explícito, sem transmissão silenciosa em outra tela.
- A área de prévia informa o monitor e a resolução do Monitor Principal, sem oferecer um seletor de destino concorrente.
- **Chrome/Vercel:** navegadores não fornecem controle confiável da posição física de janelas em monitores. A seleção e resolução de um monitor real são aplicadas automaticamente apenas na versão Electron. Na web, o usuário deve mover a janela manualmente.
- Itens do tipo **Imagem** aceitam PNG, JPG, WebP e GIF de até 20 MB. As imagens ficam no IndexedDB do perfil local. Backups em JSON ainda não contêm o arquivo binário da imagem.

## Itens compactos e menu de contexto (padrão OBS)

Em uma cena, **Adicionar item** abre apenas uma lista com quatro fontes: Música,
Texto, Bíblia e Imagem. Clicar em um tipo cria imediatamente o item com seu nome padrão,
sem pedir título. Para alterar o nome **somente daquele item da cena**, clique com o
botão direito sobre ele e escolha **Renomear** (ou use F2 com o item em foco).

Os itens da cena aparecem em linhas compactas, com destaque azul para o selecionado,
ícone de conteúdo, posição e controles de **visibilidade** (olho) e **bloqueio de posição**
(cadeado). Desabilitar a visibilidade oculta o conteúdo na prévia e na transmissão;
bloquear impede mover esse item por arraste ou pelo menu. As preferências são gravadas
junto com a cena e preservadas ao reabrir o aplicativo.

O clique direito abre um menu com Renomear, Duplicar, Ocultar/Mostrar, Bloquear/
Desbloquear, Mover para cima/baixo, Tornar principal e Remover. A posição nº 1 segue
sendo o item principal. A reordenação continua disponível por arrastar e soltar.

## Composição de cenas em camadas

A cena é agora uma composição visual de **todos os itens visíveis**, em vez de um
único item selecionado. Como nas fontes do OBS, a **posição 1 é a camada mais alta**;
as posições seguintes aparecem atrás, respeitando a ordem e o controle de visibilidade.

Exemplo: Cena Louvor com **Texto na posição 1** e **Imagem na posição 2** mostra a
letra centralizada e legível sobre a foto, na prévia e na transmissão. Arrastar a
imagem para a posição 1 faz com que ela cubra o texto, caso seja opaca. Ocultar
um item elimina apenas aquela camada, mantendo os outros itens da cena.

Clicar numa fonte altera **apenas o editor**; a prévia continua mostrando a cena
completa. Avançar para outro trecho de texto ou letra muda somente aquela fonte,
sem apagar a imagem de fundo. A janela de projeção Electron recebe a composição
com a mesma ordem e não troca a prévia privada pelo conteúdo de um único item.

Imagens/áudio continuam locais ao dispositivo; o backup JSON preserva metadados
e a ordem, mas não inclui os binários.

## Transcrição automática de músicas

No aplicativo **Electron para Windows**, abra **Músicas → Letras e tempos** e
clique em **Transcrever IA**. O Nosso Culto utiliza o modelo `whisper-1` da API
OpenAI para reconhecer a voz do áudio e receber **timestamps de palavras**.
As palavras são agrupadas em versos curtos; o resultado preenche
automaticamente os campos de **Letra**, **Trechos** e **Início (s)**.

**Configuração inicial:**
1. Gere uma chave em https://platform.openai.com/api-keys e configure faturamento
   na plataforma de API, quando necessário. A API é **cobrada separadamente**
   de assinaturas ChatGPT e **não é gratuita por padrão**.
2. No modal **Transcrever IA**, cole a chave `sk-...` e salve. A chave é
   criptografada pela API `safeStorage` do Electron no Windows e armazenada
   no perfil local do aplicativo, **não** no React, no backup ou no GitHub.
   Opcionalmente, use a variável de ambiente `OPENAI_API_KEY` no computador.
3. Escolha a língua (ou detecção automática), clique em **Transcrever e
   sincronizar** e aguarde. **Somente após esse clique** o arquivo de áudio
   é enviado à OpenAI; é necessário estar conectado à internet.
4. Confira a letra gerada. Se quiser corrigir palavras, use **Editar letra**;
   para sincronizar melhor os tempos, use **Marcar agora** ou os campos numéricos.

Limites atuais: arquivos locais MP3, WAV, FLAC, M4A e OGG de até **25 MB**.
Áudios AAC/OPUS precisam ser convertidos para um dos formatos aceitos.
Arquivos maiores que 25 MB precisam ser comprimidos ou divididos antes.
O serviço tem limite de 3 minutos por requisição; o operador pode cancelar.

**Importante:** reconhecimento de canto é mais difícil que reconhecimento de fala:
harmonias, instrumentos, refrões e vozes sobrepostas podem resultar em letras
imprecisas, frases faltando ou tempos inexatos. A revisão dos trechos antes de
transmitir é indispensável. A letra e os tempos salvos continuam disponíveis
offline depois da transcrição. A funcionalidade de transcrição **não aparece na
versão web/Vercel** porque a chave da API não deve ficar exposta no navegador.

O build Windows executa `npm test` (agrupamento/timing), `npm run build`
e gera o instalador `.exe`. O teste de integração real da API depende de
uma chave válida e de uma música para enviar, por isso não é realizado no CI.

## Erro: transcriptionStatus is not a function

Esse erro indica que a interface React está mais recente do que o processo Electron
que carregou `electron/preload.cjs` (comum após editar os arquivos enquanto
`npm run dev` permanece aberto). O preload é carregado apenas ao criar a janela;
recarregar o React ou usar F5 não atualiza a integração nativa.

**Desenvolvimento:** encerre todos os processos Electron do Nosso Culto (use o
Gerenciador de Tarefas se necessário), execute `git pull origin main`, `npm install`
e `npm run dev` em um terminal novo. **Programa instalado:** baixe e execute
o instalador Windows da execução mais recente do GitHub Actions e reabra o programa.

A interface agora verifica a disponibilidade de todos os métodos necessários,
apresenta um diagnóstico claro e não tenta iniciar transcrição quando a integração
está desatualizada. O teste `npm test` também verifica o contrato entre a UI,
o preload e os handlers do Electron.


### Motor local não encontrado / botão Verificar novamente

Se aparecer **Esta instalação não contém o motor de transcrição**, o aplicativo agora
indica se você está rodando o código-fonte em desenvolvimento (`npm run dev`)
ou uma instalação Windows. O botão **Verificar novamente** mostra a hora da
nova verificação e quais executáveis ainda estão ausentes. Ele não instala o
motor: apenas confere os arquivos. O botão **Abrir instalador Windows** abre
o GitHub Actions, onde você poderá baixar a execução bem-sucedida mais recente.

Atenção: `npm install` / `npm run dev` não instalam o executável nativo.
Para ter o motor no modo de desenvolvimento, execute
`npm run prepare:transcription:win` em um ambiente Windows com CMake e
ferramentas C++ de compilação. Para usuários normais, instale a versão Windows
completa usando o artefato `nosso-culto-windows`.

A rotina de build agora **falha se os executáveis do Whisper e FFmpeg não
estiverem presentes em `win-unpacked/resources/transcription`**, evitando
publicar um instalador sem o motor de reconhecimento.
<<<<<<< HEAD
=======

### Manipulação da janela de transmissão

A janela de projeção do Electron permanece **sem moldura e sem botões de
minimizar, maximizar ou fechar**. Quando não está em tela cheia, ela pode ser
**movida segurando e arrastando os 30 pixels superiores** da imagem.

Controles de teclado (na janela de transmissão):

- **F11** alterna entre o modo janela e a tela cheia.
- **Esc em tela cheia** volta ao modo janela sem encerrar a transmissão.
- **Esc no modo janela** fecha a saída de projeção e encerra a transmissão.

A janela abre no monitor especificado em **Configurações → Projeção → Monitor
Principal**. Ao encerrar a saída com Esc, o painel de controle volta para
**Iniciar transmissão**. Os atalhos nativos acima são específicos da versão
Electron; a versão web usa os controles do navegador.
>>>>>>> e9b430202cdcfbc3dafd2146e6c46a443d0d346d

## Biblioteca de músicas no navegador (Chrome, Vercel)

A versão Web também pode importar e trabalhar com músicas. Em **Música → Conteúdos**,
use **Arquivos** para selecionar MP3, WAV, FLAC, M4A, AAC, OGG, OPUS e arquivos
LRC; **Pasta** para importar músicas de um diretório; ou **ZIP** para importar
um pacote de músicas e respectivas letras LRC. O navegador pede autorização
de acesso apenas aos arquivos/pasta escolhidos.

Os arquivos de áudio são armazenados no **IndexedDB do navegador** (não em
localStorage, não no Vercel). O player carrega uma URL de objeto temporária e
permite reproduzir, pausar, buscar tempo, editar letra, importar LRC e ajustar
marcas de tempo. Letras, cenas e metadados são persistidos na configuração
local da versão web, como antes. O modo Electron continua usando os arquivos
locais e seu protocolo `culto-media://`, sem sofrer alterações.

Os dados **não são sincronizados entre dispositivos, navegadores ou perfis**.
Limpar os dados do site pode apagar os áudios e as informações salvas.
O limite por faixa é 120 MB; ZIP até 256 MB comprimido, com limites para
arquivos extraídos. Importar pastas utiliza a seleção de diretórios compatível
com navegadores Chromium. A transcrição automática por IA **permanece
exclusiva do desktop**; na Web, use LRC, edição manual e distribuição de tempos.

## Cenas compactas e menus de contexto

**Cenas** e **Itens da cena** usam linhas compactas com número, ícone e nome.
Os botões + dos cabeçalhos e os botões inferiores redundantes de Renomear/Excluir
foram removidos. Para criar, use **Nova cena** ou **Adicionar item**, no rodapé de
cada coluna. O botão **Importar músicas** permanece no rodapé de Conteúdos.

Clique com o botão direito em uma cena para **Renomear**, **Duplicar**,
**Bloquear/Desbloquear posição**, **Mover para cima/baixo**, **Mover para o início**
ou **Excluir**. Para renomear, também é possível dar clique duplo ou pressionar
**F2** com a cena em foco. A duplicação mantém as fontes associadas mas cria
novos IDs para a cena e seus itens.

Segure e arraste uma cena verticalmente: a linha roxa mostra se ela será
posicionada acima ou abaixo do alvo. Cenas bloqueadas não podem ser arrastadas
nem deslocadas pela reordenação de outras cenas. A ordem e o bloqueio
ficam salvos com as cenas (web e Electron). Os itens continuam com
o menu de contexto, a visibilidade, o bloqueio e o arraste existentes.

## Posicionamento de fontes com guias na pré-visualização

Na pré-visualização, segure o **botão direito** sobre um texto, letra, versículo
ou imagem e arraste. O app apresenta guias em uma grade **3×3** e encaixa
o centro da fonte automaticamente em uma das nove áreas.

Para movimentos **livres**, mantenha **Shift + botão direito** durante o
arraste: as guias continuam visíveis, mas não restringem a posição. O
arraste é feito com eventos de ponteiro, não com o menu nativo do navegador.
Fontes com posição bloqueada não podem ser movimentadas.

As posições são salvas individualmente em percentuais relativos ao quadro
de saída, de modo que preview e projeção usem as mesmas coordenadas,
independentemente da resolução de cada monitor. Imagens antigas sem posição
continuam preenchendo o quadro; após o primeiro posicionamento, tornam-se
objetos móveis menores para permitir sua composição com textos e fundos.

### Pré-visualização interativa e títulos de itens

A pré-visualização captura o arraste na própria superfície, identificando
a camada atingida (texto, versículo, letra ou imagem). **Botão direito +
arrastar** encaixa no grid 3×3; **Shift + botão direito + arrastar** move
livremente. As linhas surgem durante o gesto. O quadro de saída não permite
edição por arraste. O bloqueio de posição dos itens continua sendo respeitado.

Os campos de título/"Nome do item" foram retirados dos editores de Texto,
Bíblia e Imagem. Para renomear, clique com o botão direito no item da cena e
escolha **Renomear**, ou selecione o item e pressione **F2**.

## Transcrição automática no navegador (Chrome/Vercel)

O botão **Transcrever** está disponível também na versão Web, quando uma música
importada está selecionada. O fluxo é o mesmo do Electron: se não há letra,
o navegador reconhece a voz e cria trechos com tempos; se existe uma letra,
tenta alinhá-la ao áudio sem trocar as palavras originais. O reconhecimento
executa um modelo Whisper multilíngue aberto **no computador do usuário**
(usando Transformers.js e WASM em um Web Worker). Não requer conta nem chave de
API e **o áudio não é enviado ao servidor da Vercel**.

Na primeira execução o navegador baixa os recursos da biblioteca via
jsDelivr e o modelo via Hugging Face; é necessária conexão à internet.
O desempenho depende de CPU, memória, navegador e tamanho do áudio.
Em músicas longas, o processamento pode levar muitos minutos. O limite web
é de 20 minutos por música, e dispositivos com pouca memória podem não
conseguir concluir. O processamento pode ser cancelado pelo botão
**Cancelar**, que interrompe e encerra o Worker.

Os tempos resultantes são estimativas do reconhecimento, não uma garantia de
sincronia perfeita: canto, instrumentos altos e corais podem produzir erros.
Quando o alinhamento da letra não consegue identificar todos os versos com
segurança, é exibida uma mensagem, em vez de inventar marcações.
O modo web usa os pesos abertos do Whisper; não representa um modelo próprio
fine-tuned treinado pela equipe.

## Precisão da transcrição cantada (navegador)

O reconhecimento anterior usava Whisper Tiny e janelas sem sobreposição, com
uma alternativa que atribuía o início de uma janela a frases sem timestamp.
Isso podia produzir letras sem relação com o canto e tempos inventados.

A versão atual passa para Whisper Base multilíngue, com blocos sobrepostos
(28 segundos, sobreposição de 6 segundos), timestamps de palavra quando
disponíveis, agrupamento por pausas e validação de tempo. Não cria
marcas quando o modelo não fornece tempos confiáveis. A nova tentativa ignora
letras anteriores com `timingSource=transcribed` para não sincronizar
automaticamente uma letra incorreta gerada pela própria IA.

**O Whisper Base não é treinado para música cantada** e ainda pode errar
palavras mesmo com timestamps plausíveis. A validação de estrutura não
comprova que a letra está correta. Sempre confira ouvindo o áudio, ou
cole uma letra revisada em **Editar letra** e clique em **Transcrever**
para tentar alinhar a referência com a gravação. Se a correspondência for
insuficiente, o sistema mantém o texto anterior em vez de inventar tempos.
O modelo maior exige novo download e pode executar mais lentamente no Chrome.
