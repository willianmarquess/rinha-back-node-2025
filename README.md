## Rinha backend 2025 - Nodejs + Fastify + Redis

## Tecnologias utilizadas

- **Runtime/Linguagem** Nodejs 22 / Javascript
- **Banco de Dados** Redis
- **Load Balancer** Nginx

## Contexto

A ideia desse projeto foi utilizar Node.js com JavaScript e Fastify e tem como principal objetivo demonstrar uma arquitetura assíncrona no backend. Cada serviço backend opera de forma independente, criando um worker dedicado para processar operações de maneira e eficiente, para realizar o sincronismo dos dados foi utilizado o Redis como banco de dados.

## Arquitetura

![arch](doc/arch.png)


## Resultados

- Resultado abaixo com MAX_REQUESTS=550, executado localmente.

```json
{
  "participante": "anonymous",
  "total_liquido": 361690.08752718277,
  "total_bruto": 333145.9,
  "total_taxas": 23982.485,
  "descricao": "'total_liquido' é sua pontuação final. Equivale ao seu lucro. Fórmula: total_liquido + (total_liquido * p99.bonus) - (total_liquido * multa.porcentagem)",
  "p99": {
    "valor": "2.505031000000001ms",
    "bonus": 0.16989938,
    "max_requests": "550",
    "descricao": "Fórmula para o bônus: max((11 - p99.valor) * 0.02, 0)"
  },
  "multa": {
    "porcentagem": 0,
    "total": 0,
    "composicao": {
      "total_inconsistencias": 0,
      "descricao": "Se 'total_inconsistencias' > 0, há multa de 35%."
    }
  },
  "lag": {
    "num_pagamentos_total": 16741,
    "num_pagamentos_solicitados": 16741,
    "lag": 0,
    "descricao": "Lag é a diferença entre a quantidade de solicitações de pagamentos vs o que foi realmente computado pelo backend. Mostra a perda de pagamentos possivelmente por estarem enfileirados."
  },
  "pagamentos_solicitados": {
    "qtd_sucesso": 16741,
    "qtd_falha": 0,
    "descricao": "'qtd_sucesso' foram requests bem sucedidos para 'POST /payments' e 'qtd_falha' os requests com erro."
  },
  "pagamentos_realizados_default": {
    "total_bruto": 259894,
    "num_pagamentos": 13060,
    "total_taxas": 12994.7,
    "descricao": "Informações do backend sobre solicitações de pagamento para o Payment Processor Default."
  },
  "pagamentos_realizados_fallback": {
    "total_bruto": 73251.9,
    "num_pagamentos": 3681,
    "total_taxas": 10987.784999999998,
    "descricao": "Informações do backend sobre solicitações de pagamento para o Payment Processor Fallback."
  }
}
```