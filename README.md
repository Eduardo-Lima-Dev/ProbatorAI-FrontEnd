# Banco de Questões (React + Vite + Tailwind)

Sistema web responsivo para visualizar quizzes em JSON com:
- listagem paginada de quizzes;
- visualização de questão individual e lista completa;
- destaque de resposta correta.

## Fontes de dados suportadas

### 1) `public/` (mais simples)
Use a pasta `public/quizzes` para arquivos estáticos.

1. Coloque os arquivos `.json` em `public/quizzes`.
2. Atualize `public/quizzes/index.json` com os nomes dos arquivos.

Exemplo:

```json
[
  "quiz-ciencias.json",
  "quiz-biologia.json"
]
```

Vantagem: muito simples e sem backend.  
Limite: para adicionar novo arquivo em produção, precisa novo deploy.

### 2) Supabase Storage (produção)
Use um bucket público para armazenar os JSONs e listar por URL.

1. Crie um bucket no Supabase, ex: `quizzes-json`.
2. Marque o bucket como público.
3. Faça upload dos arquivos `.json` pelo painel/admin.
4. Configure ambiente com base em `.env.example`:

```bash
cp .env.example .env
```

Preencha:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_BUCKET`

5. Inicie a aplicação e use o botão **Carregar do Supabase Storage**.

Vantagem: sem redeploy para novos arquivos, URLs públicas e consumo por qualquer site (com CORS adequado).

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build e verificação

```bash
npm run lint
npm run build
```
