import os

SECRET_KEY = os.environ["SUPERSET_SECRET_KEY"]
SQLALCHEMY_DATABASE_URI = (
    "postgresql+psycopg2://superset:"
    f"{os.environ['SUPERSET_DB_PASSWORD']}@superset-postgres:5432/superset"
)
REDIS_HOST = "superset-redis"
REDIS_PORT = 6379
WTF_CSRF_ENABLED = True
TALISMAN_ENABLED = False  # TLS is terminated by the VPS reverse proxy.

# Analítica embebida por organización (spec 007). El propio SDK
# (@superset-ui/embedded-sdk) requiere este feature flag para servir un
# dashboard dentro de un iframe ajeno a Superset.
FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}

# Firma los guest tokens de embedding (research.md #3/#5 de la spec 007) —
# distinto de SECRET_KEY, para no acoplar la rotación de uno con la del
# otro.
GUEST_TOKEN_JWT_SECRET = os.environ["SUPERSET_GUEST_TOKEN_JWT_SECRET"]

# Rol asignado a cualquier guest token (permisos mínimos: solo ver el
# dashboard que el token autoriza). Se crea a mano una vez en Superset
# (Settings > List Roles > Add), sin permisos propios — no es algo que
# esta configuración pueda crear.
GUEST_ROLE_NAME = "Guest"

# Habilita que el navegador de Refine (otro origen) pueda pedir el iframe
# embebido. El dominio real se toma de una variable de entorno, no se
# hardcodea localhost.
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "origins": [os.environ.get("REFINE_ORIGIN", "http://localhost:3100")],
}
