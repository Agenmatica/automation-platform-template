# CI self-hosted y almacenamiento

Los jobs principales usan runners self-hosted. No se configura `cache: pnpm`
en `actions/setup-node`: las cachés de dependencias se almacenan en GitHub
aunque el job se ejecute en infraestructura propia. El runner persistente usa
su store local de pnpm para evitar almacenamiento remoto innecesario.
