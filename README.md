# Nosso Culto — React Native Windows

Base de aplicativo desktop para projeção de cultos. **Tauri e Vite foram removidos**. A interface foi reescrita utilizando componentes React Native (View, Text, Pressable, TextInput, ScrollView), com TypeScript, biblioteca local, sequência do culto, editor de letras, slides e temas.

## Pré-requisitos Windows

- Node.js compatível com React Native 0.84 (22+)
- Visual Studio 2022 com workload **Desktop development with C++** e SDK Windows
- Ferramentas e dependências RNW: https://microsoft.github.io/react-native-windows/docs/rnw-dependencies

## Preparar a solução Windows (uma vez)

O CLI oficial gera os arquivos nativos C++/WinAppSDK específicos do Windows. Nesta migração, os fontes React Native foram publicados no repositório, mas a geração da pasta `windows/` precisa acontecer no computador Windows preparado.

```powershell
npm install
npx react-native init-windows --template cpp-app --name NossoCulto --namespace NossoCulto --overwrite
npx react-native run-windows
```

Depois de gerar os arquivos nativos, **adicione a pasta `windows/` ao Git** para que outros computadores possam compilar diretamente, sem reinicialização.

## O que já funciona no código

- Biblioteca de músicas e textos com cadastro, edição, exclusão e pesquisa
- Quebra de letras em slides por parágrafo
- Programação com adição e remoção de conteúdo
- Pré-visualização, navegação por slides, três temas e modo de projeção em tela cheia dentro do aplicativo
- Armazenamento local por AsyncStorage

## Limitações que ainda precisam de desenvolvimento

- A projeção **não é uma segunda janela nativa**: para projetor independente será necessário módulo WinAppSDK/C++ e gerenciamento de monitores.
- Não há banco SQLite, catálogo bíblico licenciado ou importação multimídia.
- O aplicativo não foi compilado no Windows neste ambiente. Instalação nativa e versões do toolchain precisam ser validadas localmente.

Documentação: https://microsoft.github.io/react-native-windows/docs/getting-started
