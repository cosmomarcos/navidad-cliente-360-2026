-- La interfaz de chat comunitario fue retirada y reemplazada por el buzón de mensajes secretos.
-- Esta migración elimina únicamente el historial del chat antiguo.
DROP TABLE IF EXISTS community_messages;
