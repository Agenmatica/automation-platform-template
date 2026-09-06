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
