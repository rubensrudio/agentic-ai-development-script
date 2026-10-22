#!/bin/bash
# Script de automação V2 - Estrutura REA + Anthropic Code Review + Evidências de Pesquisa (2026)

echo "🚀 Configurando estrutura aprimorada REA + Anthropic Code Review no repositório..."

# Criar diretórios necessários
mkdir -p .claude/commands
mkdir -p .claude/skills/herdr
mkdir -p src/contracts

# Backup de arquivos existentes antes de sobrescrever
BACKUP_TS=$(date +%Y%m%d-%H%M%S)
backup_if_exists() {
  if [ -f "$1" ]; then
    cp "$1" "$1.bak.$BACKUP_TS"
    echo "💾 Backup: $1 -> $1.bak.$BACKUP_TS"
  fi
}

# 1. Gerar CLAUDE.md (Diretrizes Principais, Regras do Quartel e Governança)
backup_if_exists CLAUDE.md
cat << 'EOF' > CLAUDE.md
# Diretrizes do Repositório: Metodologia REA + Anthropic Code Review

## 1. Visão Geral e Papéis
- **Orquestrador (Chief of Staff / Sargento):**
  - Define arquitetura, constrói contratos tipados prévios em `src/contracts/`, lança e monitora agentes via `herdr`, executa testes E2E reais e consolida commits na branch integradora.
- **Sub-Agente de Código (Exército de Implementação):**
  - Implementa funcionalidades em escopos/pastas estritamente isolados.
- **Sub-Agente Revisor (Contexto Limpo):**
  - Executa a revisão estática do `git diff` sem memória prévia do processo de geração para evitar viés.

---

## 2. Regras Estritas do Quartel (Para Sub-Agentes)
1. **Isolamento de Escopo:** Edite APENAS os arquivos das pastas atribuídas no seu briefing.
2. **Proibição de Instalação:** NUNCA execute `npm install`, `yarn add` ou modifique `package.json` sem autorização.
3. **Proibição de Execução de Servidor:** NUNCA inicie servidores de aplicação ou processos em background.
4. **Proibição de Commits:** NUNCA execute `git commit`, `git push` ou altere branches.
5. **Solicitações de Mudança Compartilhada:** Se precisar alterar um contrato em `src/contracts/` ou arquivo global, crie um arquivo `.change-request.md` na raiz detalhando o motivo e o diff sugerido.
6. **Protocolo de Conclusão:** 
   - Execute o `typecheck` local da sua pasta.
   - Escreva um relatório de alterações em `.status-report.md`.
   - Responda no terminal APENAS com a palavra: **PRONTO**.

---

## 3. Diretrizes Anti-Regressão e Governança de Code Review
- **Teto de Rodadas de Correção (Máximo 3 Iterações):** Se um sub-agente não resolver um bug/apontamento após 3 interações, interrompa os nitpicks. O orquestrador deve solicitar a reavaliação completa da abordagem para evitar loops infinitos de tokens e pequenos ajustes.
- **Contexto Limpo na Revisão:** A revisão de PRs/diffs deve ser feita por um sub-agente zerado que lê apenas o `git diff`, a intenção da tarefa e as regras do `REVIEW.md`.
- **Validação E2E e Não-Confiança em Testes Sintéticos:** Como agentes de IA frequentemente geram suítes de teste que não capturam regressões complexas (cobertura de mutação fraca), o Orquestrador DEVE validar a aplicação em execução (via UI/screenshots ou logs de execução real) antes do merge.
EOF

# 2. Gerar REVIEW.md (Catálogo de Indicadores de Falha e Regras de Revisão estilo Anthropic)
backup_if_exists REVIEW.md
cat << 'EOF' > REVIEW.md
# Catálogo de Revisão de Código (REVIEW.md)

Este arquivo serve como "colinha" para os sub-agentes revisores e para o orquestrador identificarem code smells e falhas frequentes.

## 1. Tipos de Falhas por Categoria

### A. Documentação e Especificação
- **Mentira / Inconsistência:** O README ou a doc afirma que uma função/configuração se comporta de certa forma (ex: ligado por padrão), mas o código faz o oposto.
- **Exemplo incorreto:** Exemplos de uso no comentário que não compilam com os tipos atuais.

### B. Configurações e Variáveis de Ambiente
- **Redirecionamento Incorreto:** Apontar URLs padrão para ambientes de staging/dev em vez de produção ou variáveis configuráveis.
- **Segredos no Código:** Chaves de API, tokens ou credenciais salvas em hardcode.

### C. Contratos e Tipagem
- **Bypass de Tipos:** Uso injustificado de `any`, `unknown` forçado ou casts perigosos (`as targetType`) sem validação runtime.
- **Quebra de Contrato:** Alteração de assinatura de interface em `src/contracts/` sem atualização de todos os módulos consumidores.

### D. Execução e Lógica Retida
- **Imports Desnecessários / Mortos:** Inclusão de pacotes pesados ou não utilizados no bundle final.
- **Efeitos Colaterais Escondidos:** Modificação de estado global dentro de rotinas puras.

---

## 2. Regras para o Revisor de IA
1. **Verificação Baseada em Evidências:** Todo comentário de bug no PR/diff DEVE citar o caminho do arquivo e o número exato da linha.
2. **Limite de Nitpicks:** Reporte no máximo 3 sugestões de estilo por revisão para evitar barulho. Foque em bugs de lógica e segurança.
3. **Filtro Social:** Apenas confirme um erro se houver certeza razoável de que a mudança quebra a intenção declarada do código.
EOF

# 3. Gerar .claude/commands/rea-orchestrate.md (Slash Command do Orquestrador)
backup_if_exists .claude/commands/rea-orchestrate.md
cat << 'EOF' > .claude/commands/rea-orchestrate.md
---
description: Inicia a orquestração avançada REA + Anthropic Review para Claude Code
---

Você é o Chief of Staff (Sargento de Desenvolvimento).
Sua missão é liderar o planejamento, a definição de contratos, a delegação para agentes no `herdr`, a revisão em 7 camadas e a integração final sem regressões.

Siga rigorosamente estas 6 fases de execução:

### Fase 1: Alinhamento Inicial e Diagnóstico de Escopo
1. Analise o pedido do usuário.
2. Faça até 3 perguntas estratégicas para definir a stack, os limites da funcionalidade e o modelo de entrega (MVP vs. Paridade Total).
3. Aguarde o aceite do usuário.

### Fase 2: Construção Prévia de Esqueleto e Contratos
1. Crie a estrutura de arquivos base e instale dependências globais se necessário.
2. Escreva todos os tipos, interfaces e contratos de comunicação em `src/contracts/`.
3. Valide a compilação do esqueleto antes de chamar os sub-agentes.

### Fase 3: Lançamento de Agentes via Herdr
1. Utilize a skill `herdr` para abrir painéis no terminal para cada módulo isolado.
2. Envie o briefing contendo o escopo exclusivo de pastas, a meta de tempo (20-25 min) e as **Regras do Quartel** (`CLAUDE.md`).

### Fase 4: Monitoramento e Teto de Rodadas
1. Aguarde a resposta **PRONTO** dos agentes no `herdr`.
2. Se um agente encontrar bugs repetidos, limite a até 3 rodadas de correção incremental. Na 3ª falha, exija reavaliação da arquitetura.

### Fase 5: Revisão por Contexto Limpo e Teste E2E Real
1. Dispare um sub-agente de revisão com contexto limpo (lendo apenas o `git diff` e `REVIEW.md`).
2. Execute a aplicação e faça a validação funcional E2E (navegação na UI, screenshots ou logs de execução real) — NUNCA confie apenas nos testes sintéticos gerados pelos sub-agentes.

### Fase 6: Merge e Commit na Branch Integradora
1. Após a aprovação do build, typecheck e testes funcionais, consolide o trabalho na branch integradora.
2. Faça o `git commit` final e apresente o resumo ao usuário.
EOF

# 4. Gerar .claude/skills/herdr/SKILL.md (Skill do Herdr)
backup_if_exists .claude/skills/herdr/SKILL.md
cat << 'EOF' > .claude/skills/herdr/SKILL.md
---
name: herdr
description: Skill para controle do multiplexador de terminal herdr na orquestração de sub-agentes de IA
---

## Comandos do Herdr CLI para Orquestração

O `herdr` permite ao Chief of Staff gerenciar múltiplos Claude Codes concorrentes:

1. **Criar Sessão / Aba:**
   ```bash
   herdr tab create --name "<NOME_DA_SESSAO>"
   ```

2. **Dividir Painel:**
   ```bash
   herdr pane split --direction horizontal|vertical --target "<SESSAO>"
   ```

3. **Enviar Briefing para Sub-Agente:**
   ```bash
   herdr send --target "<NOME_DO_PAINEL>" "<TEXTO_DO_PROMPT>"
   ```

4. **Verificar Status dos Agentes:**
   ```bash
   herdr status list
   ```
   *Estados:* `idle`, `working`, `blocked`, `ready` (PRONTO).

5. **Capturar Saída de um Painel:**
   ```bash
   herdr capture --target "<NOME_DO_PAINEL>" --lines 50
   ```
EOF

# 5. Gerar TEMPLATE_BRIEFING_SUBAGENTE.md (Template de Prompt para Sub-Agentes)
backup_if_exists TEMPLATE_BRIEFING_SUBAGENTE.md
cat << 'EOF' > TEMPLATE_BRIEFING_SUBAGENTE.md
Você é o sub-agente especialista responsável pelo módulo: **[NOME_DO_MODULO]**.

### 1. Escopo de Trabalho
- **Sua Pasta Exclusiva:** `[CAMINHO_DA_PASTA]`
- **Contratos Globais (Leitura):** `src/contracts/`

### 2. Tarefa Atribuída
[DESCREVER A FUNCIONALIDADE E META DE TEMPO DE 20-25 MINUTOS]

### 3. Regras Estritas do Quartel
- Trabalhe APENAS na sua pasta atribuída.
- NÃO execute `npm install`.
- NÃO inicie o servidor da aplicação.
- NÃO faça `git commit`.
- Se precisar alterar arquivos globais, crie um arquivo `.change-request.md`.

### 4. Finalização
Ao concluir a implementação:
1. Garanta que o `typecheck` do seu código está passando.
2. Crie um resumo no arquivo `.status-report.md`.
3. Responda no terminal estritamente com a palavra: **PRONTO**.
EOF

echo "✅ Estrutura V2 atualizada com sucesso!"
echo "Arquivos gerados/atualizados:"
echo " - CLAUDE.md"
echo " - REVIEW.md"
echo " - .claude/commands/rea-orchestrate.md"
echo " - .claude/skills/herdr/SKILL.md"
echo " - TEMPLATE_BRIEFING_SUBAGENTE.md"
