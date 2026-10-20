# Nosso Culto AI — treinamento especializado em canto (fase de pesquisa)

Este módulo é **código de treinamento e avaliação**, não um modelo treinado.
A experiência do operador continua sendo apenas **Transcrever**. Os pesos
originais do Whisper continuam ativos até haver resultados mensuráveis e uma
versão convertida, testada e aprovada. Nenhuma transcrição perfeita ou
instantânea é prometida.

## 1. Preparar dados autorizados

Use gravações próprias ou arquivos com autorização explícita para treinamento.
Não inclua músicas comerciais, letras protegidas ou áudios de terceiros sem
permissão. Não faça upload de gravações pessoais para o repositório.

Anote trechos **com início e fim reais** (entre 1 e 30 segundos) em um JSONL,
uma linha por trecho, por exemplo:

```json
{"recording":"gravacao-autorizada.wav","start":12.4,"end":19.8,"text":"Verso conferido por uma pessoa","split":"train","licensed":true}
```

O campo `split` deve ser `train`, `validation` ou `test`. Gravações
inteiras devem permanecer na mesma divisão, evitando que trechos da mesma
música apareçam simultaneamente no treino e no teste. Não copie o exemplo como
um dado real; anote áudios efetivamente disponíveis.

Pré-requisitos de pesquisa: Python 3.11 ou 3.12, FFmpeg, GPU CUDA recomendada,
espaço em disco e capacidade de baixar modelos abertos (licenças aplicáveis).

```powershell
py -3.12 -m venv .venv-ai
.\.venv-ai\Scripts\Activate.ps1
python -m pip install -r ai/requirements-train.txt
python ai/prepare_dataset.py --manifest ai/data/manifest.jsonl --source-root ai/data/gravacoes --output ai/data/ready
```

O preparador exige autorização declarada, bloqueia caminhos fora da pasta,
recusa trechos inválidos e separa conjuntos sem vazamento de gravações.

## 2. Treinar e comparar

```powershell
python ai/train_whisper.py --data ai/data/ready --output ai/runs/whisper-pt-canto --base-model openai/whisper-small
```

O treinamento faz *fine-tuning* de Whisper-small em canto com rótulos revisados,
avalia no conjunto de validação e compara o WER no teste independente
com os pesos originais. O arquivo `quality-report.json` informa se houve
ganho relativo mínimo e se a taxa de erro ficou abaixo do limite.
**Esse relatório não valida sincronização temporal.**

Para validar os tempos de início de versos em gravações reservadas para teste:

```powershell
python ai/evaluate_timing.py --input ai/data/verse-onsets-test.jsonl --output ai/runs/timing-quality.json
```

Uma linha desse JSONL corresponde a uma gravação distinta:

```json
{"recording":"teste.wav","reference":[{"time":12.4,"text":"Verso verdadeiro"}],"prediction":[{"time":12.7,"text":"Verso verdadeiro"}]}
```

A avaliação mede cobertura dos versos e erro médio absoluto em segundos,
exigindo por padrão >=90% de cobertura e <=0,5 segundo de erro.
É preciso produzir as predições a partir do **modelo candidato** e do
sincronizador real; o script não as inventa.

## 3. Promover somente após avaliação

- **Web:** exportar o modelo aprovado para formato **Transformers.js/ONNX**,
  hospedar os pesos no repositório de modelos autorizado e validar os arquivos,
  o carregamento no Chrome, a latência e a precisão. Somente então atualizar
  `public/ai/active-model.json` com `model_id`, `quality_gate_passed`,
  `timing_gate_passed` e `browser_export_verified`. Um manifesto não é uma
  prova de qualidade; mantenedores devem auditar métricas e artefatos.
  O navegador usa o Whisper Base como fallback se o modelo aprovado falhar.
- **Desktop:** converter e testar os pesos para formato GGML compatível
  com o whisper.cpp usado no instalador, colocar em
  `build-tools/transcription/models/ggml-nosso-culto-ai.bin` e criar o
  `release.json` contendo os mesmos indicadores de qualidade, o SHA-256
  real e `ggml_export_verified: true`. O motor só utiliza pesos íntegros.
  Caso contrário, mantém o Whisper Base atual.

Não altere as flags para `true` antes das avaliações. A compatibilidade do
checkpoint Whisper treinado com o exportador ONNX/GGML **não é automática**:
é uma etapa técnica separada, com testes no navegador e no Electron.

## Limites atuais

- Não há corpus de gravações autorizado incluído neste repositório.
- **Ainda não existem pesos personalizados treinados ou promovidos**.
- Fine-tuning de reconhecimento **não substitui** separação vocal nem
  alinhamento acústico; corais e instrumentos continuam difíceis.
- O processamento de uma gravação inédita demanda tempo; cache de
  transcrições autorizadas pode melhorar repetições futuras.
- Artefatos de pesquisa em `ai/data` e `ai/runs` são ignorados pelo Git.

## 4. Ativação guiada por qualidade (somente mantenedores)

Depois de exportar os pesos e **testar de verdade** a execução no alvo,
gere os manifestos com um comando específico. Ele recusa modelos sem
aprovação de WER e dos tempos, e exige confirmação explícita da exportação:

```powershell
python ai/promote_model.py --target web --training-report ai/runs/whisper-pt-canto/quality-report.json --timing-report ai/runs/timing-quality.json --model-id Organizacao/modelo-pt-canto-onnx --onnx-verified --confirmed-runtime-tests
```

Para o Electron, forneça o binário GGML testado:

```powershell
python ai/promote_model.py --target desktop --training-report ai/runs/whisper-pt-canto/quality-report.json --timing-report ai/runs/timing-quality.json --weights caminho/ggml-personalizado.bin --ggml-verified --confirmed-runtime-tests
```

**Não execute esses comandos antes do treinamento real e da validação.**
Os manifestos não são substitutos de avaliações nem certificações.
O script não converte pesos automaticamente.
