# Realtime Gateway en Postman

Esta guia explica como probar el `realtime-gateway` con un request Socket.IO en Postman.

## Requisitos

1. Levanta los contenedores del proyecto.
2. En Postman ejecuta `Auth > Login` o `Auth > Register`.
3. Confirma que la variable `accessToken` tenga valor.

## Abrir la conexion Socket.IO

En Postman abre la conexion Socket.IO guardada para el `realtime-gateway`.

La configuracion esperada de esa conexion es:

URL:

```txt
https://localhost?token={{accessToken}}
```

En `Settings`:

```txt
Socket.IO version: v4
Handshake path: /socket.io
SSL certificate verification: OFF
```

Si la conexion falla, revisa que esos valores sigan iguales. Socket.IO usa `/socket.io` como path default.

## Event listeners

Antes de conectar, abre la pestana `Events` y agrega estos listeners:

```txt
gateway:ready
gateway:error
lobby:joined
lobby:left
game:joined
game:left
game:state
matchmaking:match-found
disconnect
```

Luego pulsa `Connect`.

Resultado esperado:

```txt
gateway:ready
```

con un payload parecido a:

```json
{
  "user": {
    "sub": "user-id",
    "email": "user@email.com",
    "username": "username"
  }
}
```

## Unirse a lobby

En la pestana `Message`:

Event name:

```txt
lobby:join
```

Payload JSON:

```json
{
  "lobbyId": "main"
}
```

Respuesta esperada:

```txt
lobby:joined
```

Payload:

```json
{
  "lobbyId": "main"
}
```

## Crear un match

Con `MATCHMAKING_MIN_PLAYERS=2`, abre dos conexiones Socket.IO autenticadas con usuarios distintos y envia `lobby:join` en ambas usando el mismo `lobbyId`.

Payload JSON en ambas conexiones:

```json
{
  "lobbyId": "main"
}
```

Respuesta esperada cuando entra el segundo jugador:

```txt
matchmaking:match-found
```

Payload:

```json
{
  "lobbyId": "main",
  "gameId": "generated-game-id",
  "playerIds": ["user-1", "user-2"]
}
```

## Salir del lobby

Event name:

```txt
lobby:leave
```

Payload JSON:

```json
{
  "lobbyId": "main"
}
```

Respuesta esperada:

```txt
lobby:left
```

## Unirse a una partida

Event name:

```txt
game:join
```

Payload JSON:

```json
{
  "gameId": "test-game-1"
}
```

Respuesta esperada:

```txt
game:joined
```

## Enviar input del jugador

Primero debes haber enviado `game:join` para el mismo `gameId`.

Event name:

```txt
game:player-input
```

Payload JSON:

```json
{
  "gameId": "test-game-1",
  "sequence": 1,
  "position": {
    "x": 1,
    "y": 0,
    "z": 2
  },
  "rotationY": 0.5
}
```

Este evento no devuelve confirmacion directa. Publica el input hacia el `game-service`.

## Salir de una partida

Event name:

```txt
game:leave
```

Payload JSON:

```json
{
  "gameId": "test-game-1"
}
```

Respuesta esperada:

```txt
game:left
```

## Errores comunes

Si conecta y se desconecta inmediatamente, revisa:

- `accessToken` esta vacio o vencido.
- La URL no incluye `?token={{accessToken}}`.
- `SSL certificate verification` sigue activo.

Si ves mensajes como `message` en vez de `lobby:join`, pusiste el evento dentro del body. El nombre del evento debe ir en el campo `Event name`, y el body debe contener solo el JSON.

Si recibes `gateway:error`, revisa el mensaje del payload. Normalmente indica token invalido, `gameId` faltante o intento de enviar input sin haberse unido a la partida.
