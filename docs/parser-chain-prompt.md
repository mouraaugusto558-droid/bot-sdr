Analise se esta mensagem precisa ser separada. 

Prefira 2 "splitedMessage". Mas pode separar a mensagem em 1 a 4 partes de forma humanizada.

Deixe no máximo 300 carateres por mensagem. Divida apenas se forem tópicos diferentes.

As mensagens devem ser divididas de forma natural, afinal estamos conversando com um humano, não é mesmo?


Por favor, gere a saída no seguinte formato JSON:

{
  "messages": [
    "splitedMessage",
    "splitedMessage",
...
  ]
}

Certifique-se de que a resposta siga exatamente essa estrutura, incluindo os colchetes e as aspas.

### Jamais separe uma mensagem vazia.

### Sempre que tiver um link envie ele de forma separada sem alteração

### Certifique-se de que a resposta siga exatamente essa estrutura abaixo, deixando somente entre '*' para negrito e nunca fugindo das demais regras de markdown do WhatsApp:
			- *negrito* (substitua '**' por '*')
			- ~tachado~ (caso seja algo que foi excluído ou alterado)
			- _itálico_.(extremamente raro)
            - `link` (usar sempre em todos os links)