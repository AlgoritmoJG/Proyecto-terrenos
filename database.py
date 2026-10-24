"""Conexión Oracle thin (sin Oracle Instant Client) y modo demo explícito."""
import json
import os
from pathlib import Path

from sqlalchemy import URL, create_engine, event, select
from sqlalchemy.orm import Session

from models import Agente, Banco, Base, CaracteristicasInmueble, Inmueble, TipoInmueble, Vendedor

ROOT = Path(__file__).resolve().parent


def build_engine(mode=None, sqlite_path=None):
    mode = mode or os.getenv('DB_MODE', 'demo')
    if mode == 'oracle':
        missing = [n for n in ('ORACLE_USER', 'ORACLE_PASSWORD', 'ORACLE_DSN') if not os.getenv(n)]
        if missing:
            raise RuntimeError('Falta configurar en .env: ' + ', '.join(missing))
        # URL.create evita problemas con @, / y otros símbolos en contraseñas.
        url = URL.create('oracle+oracledb', username=os.environ['ORACLE_USER'], password=os.environ['ORACLE_PASSWORD'])
        return create_engine(url, connect_args={'dsn': os.environ['ORACLE_DSN']}, pool_pre_ping=True, hide_parameters=True)
    if mode != 'demo':
        raise RuntimeError('DB_MODE debe ser demo u oracle. No se usa fallback automático.')
    path = Path(sqlite_path) if sqlite_path else ROOT / 'instance' / 'terrena.db'
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(URL.create('sqlite', database=str(path)), hide_parameters=True)

    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')

    return engine


def seed_demo(engine):
    """Idempotente: nunca vacía ni reemplaza un catálogo existente."""
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        if s.scalar(select(Inmueble.id_inmueble).limit(1)) is not None:
            return
        # No asignar IDs de forma manual: Oracle usa columnas IDENTITY.
        data = json.loads((ROOT / 'data' / 'demo.json').read_text(encoding='utf-8'))
        for b in data['bancos']:
            if not s.scalar(select(Banco).where(Banco.nit == b['nit'])):
                s.add(Banco(**{k: v for k, v in b.items() if k != 'id_banco'}))
        types = {t: TipoInmueble(nombre_tipo=t) for t in ('Casa', 'Apartamento', 'Terreno')}
        agents = {'Ana Martínez': Agente(codigo_agente=1001, nombre='Ana', apellido='Martínez', antiguedad_empresa=4),
                  'Diego Morales': Agente(codigo_agente=1002, nombre='Diego', apellido='Morales', antiguedad_empresa=3)}
        s.add_all([*types.values(), *agents.values()])
        for p in data['inmuebles']:
            first, _, last = p['vendedor'].partition(' ')
            seller = Vendedor(nombre=first, apellido=last)
            item = Inmueble(**{k: p[k] for k in ('nombre', 'direccion', 'ciudad', 'precio', 'antiguedad', 'modelo', 'material', 'metraje', 'estado', 'disponibilidad', 'descripcion', 'imagen', 'destacado')}, tipo=types[p['tipo']], vendedor=seller, agente=agents[p['agente']])
            item.caracteristicas = CaracteristicasInmueble(**{k: v for k, v in p['caracteristicas'].items() if k not in ('id_caracteristica', 'inmueble_id')})
            s.add(item)
        s.commit()
