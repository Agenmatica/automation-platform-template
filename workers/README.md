# Workers

Cada worker futuro vive en su propia carpeta con Dockerfile, contrato de entrada,
salida idempotente, healthcheck y pruebas. No se crea un worker hasta identificar
una automatización concreta que Kestra necesite ejecutar.
