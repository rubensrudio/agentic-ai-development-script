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
