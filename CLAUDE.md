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
