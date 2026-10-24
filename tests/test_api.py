from decimal import Decimal
import os
import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import create_app
from database import build_engine, seed_demo
from models import Banco, CaracteristicasInmueble, Comprador, Inmueble, Prestamo, Solicitud


@pytest.fixture(scope='module')
def app(tmp_path_factory):
    if os.getenv('TERRENA_ORACLE_TEST') == '1':
        engine = build_engine('oracle')
        seed_demo(engine)
        engine.dispose()
        application = create_app({'TESTING': True, 'DB_MODE': 'oracle'})
    else:
        application = create_app({'TESTING': True, 'DB_MODE': 'demo', 'SQLITE_PATH': tmp_path_factory.mktemp('db') / 'test.db'})
    yield application
    application.extensions['db_engine'].dispose()


@pytest.fixture
def client(app):
    return app.test_client()


def request_data(**extra):
    return {'nombre': 'Persona', 'apellido': 'Prueba', 'telefono': '55550000', 'correo': 'prueba@example.com', 'mensaje': 'Datos ficticios para una prueba.', 'inmueble_id': 1, **extra}


def test_health_executes_database_query(client, app):
    r = client.get('/api/health')
    assert r.status_code == 200
    assert r.json == {'status': 'ok', 'database': app.config['DB_MODE']}


def test_catalog_reads_relations_and_money(client):
    r = client.get('/api/catalogo')
    assert r.status_code == 200
    assert len(r.json['inmuebles']) == 6
    p = r.json['inmuebles'][0]
    assert p['ciudad'] == 'San José Acatempa'
    assert p['precio'] == 1850000
    assert p['tipo'] == 'Casa'
    assert p['caracteristicas']['inmueble_id'] == p['id_inmueble']
    assert p['caracteristicas']['num_habitaciones'] == 3
    assert len(r.json['bancos']) == 3


def test_contact_persists_buyer_and_request(client, app):
    r = client.post('/api/solicitudes', json=request_data())
    assert r.status_code == 201
    with Session(app.extensions['db_engine']) as s:
        record = s.get(Solicitud, r.json['id_solicitud'])
        buyer = s.get(Comprador, r.json['comprador_id'])
        assert record.comprador_id == buyer.id_comprador
        assert buyer.nombre == 'Persona'
        assert record.inmueble_id == 1
        assert record.estado == 'Pendiente'


def test_simulation_is_atomic_and_uses_bank_rate_and_property_price(client, app):
    r = client.post('/api/solicitudes', json=request_data(financiamiento={'banco_id': 1, 'plazo_meses': 240, 'enganche_porcentaje': 20, 'tasa_interes': 0, 'monto_prestado': 1}))
    assert r.status_code == 201
    loan = r.json['prestamo']
    assert loan['monto_prestado'] == 1480000
    assert loan['tasa_interes'] == 8.5
    assert loan['estado'] == 'Simulacion'
    assert loan['fecha_desembolso'] is None
    with Session(app.extensions['db_engine']) as s:
        assert s.get(Prestamo, loan['id_prestamo']).comprador_id == r.json['comprador_id']


@pytest.mark.parametrize('change', [{'correo': 'incorrecto'}, {'nombre': ' '}, {'telefono': 'x' * 26}, {'inmueble_id': 'invalido'}, {'financiamiento': {'banco_id': 1, 'plazo_meses': 240, 'enganche_porcentaje': 'NaN'}}, {'financiamiento': {'banco_id': 99999, 'plazo_meses': 240, 'enganche_porcentaje': 20}}])
def test_bad_input_has_no_partial_writes(client, app, change):
    with Session(app.extensions['db_engine']) as s:
        count = s.scalar(select(func.count()).select_from(Comprador))
    assert client.post('/api/solicitudes', json=request_data(**change)).status_code == 400
    with Session(app.extensions['db_engine']) as s:
        assert s.scalar(select(func.count()).select_from(Comprador)) == count


def test_unknown_property_rejected(client):
    assert client.post('/api/solicitudes', json=request_data(inmueble_id=99999)).status_code == 404


def test_invalid_json_rejected(client):
    assert client.post('/api/solicitudes', json=['not', 'object']).status_code == 400
    assert client.post('/api/prestamos', json={}).status_code == 400


def test_database_unique_constraints(app):
    with Session(app.extensions['db_engine']) as s:
        s.add(CaracteristicasInmueble(inmueble_id=1))
        with pytest.raises(IntegrityError):
            s.flush()
        s.rollback()
        s.add(Banco(nombre='Duplicado', nit='DEMO-001'))
        with pytest.raises(IntegrityError):
            s.flush()


def test_database_foreign_keys_and_delete_restrict(app):
    with Session(app.extensions['db_engine']) as s:
        for model in (CaracteristicasInmueble(inmueble_id=999999), Prestamo(banco_id=999999, comprador_id=999999, inmueble_id=1, monto_prestado=100, tasa_interes=8, plazo_meses=120, estado='Simulacion')):
            s.add(model)
            with pytest.raises(IntegrityError):
                s.flush()
            s.rollback()
        s.delete(s.get(Inmueble, 1))
        with pytest.raises(IntegrityError):
            s.flush()


def test_seed_is_repeatable_and_preserves_requests(app):
    with Session(app.extensions['db_engine']) as s:
        before = s.scalar(select(func.count()).select_from(Solicitud))
    seed_demo(app.extensions['db_engine'])
    with Session(app.extensions['db_engine']) as s:
        assert s.scalar(select(func.count()).select_from(Inmueble)) == 6
        assert s.scalar(select(func.count()).select_from(Solicitud)) == before


def test_local_files_not_exposed(client):
    for path in ('/.env', '/app.py', '/models.py', '/instance/terrena.db'):
        assert client.get(path).status_code == 404
    assert client.get('/').status_code == 200
    assert client.get('/images/acatempa-map.svg').status_code == 200


def test_explicit_oracle_does_not_fallback(monkeypatch):
    monkeypatch.delenv('ORACLE_PASSWORD', raising=False)
    with pytest.raises(RuntimeError, match='ORACLE_PASSWORD'):
        build_engine('oracle')
