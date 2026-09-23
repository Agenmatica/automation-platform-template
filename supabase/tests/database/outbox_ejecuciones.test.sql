begin;
select plan(1);

select pass('Esqueleto de pruebas de outbox creado antes de su implementación');

select * from finish();
rollback;
