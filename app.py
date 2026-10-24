"""Servidor Python del catálogo Terrena y API de conexión a Oracle."""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import os
from pathlib import Path
import re

import click
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from database import build_engine, seed_demo
from models import Banco, Base, Comprador, Inmueble, Prestamo, Solicitud

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')


def serialize(model):
    result = {}
    for column in model.__table__.columns:
        value = getattr(model, column.key)
        if isinstance(value, Decimal):
            value = float(value)
        elif isinstance(value, datetime):
            value = value.isoformat()
        result[column.key] = value
    return result


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None)
    app.config.update(MAX_CONTENT_LENGTH=16 * 1024, DB_MODE=os.getenv('DB_MODE', 'demo'), SQLITE_PATH=os.getenv('DEMO_DB_PATH'))
    if test_config:
        app.config.update(test_config)
    engine = build_engine(app.config['DB_MODE'], app.config.get('SQLITE_PATH'))
    app.extensions['db_engine'] = engine
    if app.config['DB_MODE'] == 'demo':
        seed_demo(engine)

    @app.after_request
    def headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        return response

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        # No devolver excepciones del driver ni parámetros/credenciales al navegador.
        app.logger.error('Fallo de base de datos: %s', type(error).__name__)
        return jsonify(error='No fue posible consultar la base de datos. Revisa la conexión y el esquema.'), 503

    @app.errorhandler(413)
    def payload_too_large(_):
        return jsonify(error='La solicitud supera el tamaño permitido.'), 413

    @app.get('/')
    def index():
        return send_from_directory(ROOT, 'index.html')

    @app.get('/src/<path:filename>')
    def source(filename):
        if not filename.endswith(('.css', '.js')):
            return '', 404
        return send_from_directory(ROOT / 'src', filename)

    @app.get('/<path:filename>')
    def asset(filename):
        return send_from_directory(ROOT / 'public', filename)

    @app.get('/api/health')
    def health():
        with engine.connect() as connection:
            connection.execute(text('SELECT 1 FROM DUAL' if app.config['DB_MODE'] == 'oracle' else 'SELECT 1'))
        return jsonify(status='ok', database=app.config['DB_MODE'])

    @app.get('/api/catalogo')
    def catalog():
        with Session(engine) as s:
            properties = s.scalars(select(Inmueble).options(joinedload(Inmueble.caracteristicas), joinedload(Inmueble.tipo), joinedload(Inmueble.vendedor), joinedload(Inmueble.agente)).order_by(Inmueble.id_inmueble)).all()
            items = []
            for p in properties:
                item = serialize(p)
                item.update(tipo=p.tipo.nombre_tipo if p.tipo else 'Inmueble',
                            agente=' '.join(filter(None, (p.agente.nombre, p.agente.apellido))) if p.agente else 'Por asignar',
                            vendedor=' '.join(filter(None, (p.vendedor.nombre, p.vendedor.apellido))) if p.vendedor else 'Por asignar',
                            caracteristicas=serialize(p.caracteristicas) if p.caracteristicas else {'num_habitaciones': 0, 'num_banos': 0, 'num_parqueaderos': 0, 'estado_conservacion': 'Sin información', 'piso': None, 'estrato': None})
                items.append(item)
            return jsonify(inmuebles=items, bancos=[serialize(b) for b in s.scalars(select(Banco).order_by(Banco.id_banco))], modo=app.config['DB_MODE'])

    @app.post('/api/solicitudes')
    def create_request():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error='Se requiere un objeto JSON.'), 400
        fields = {}
        for key, maximum in [('nombre', 50), ('apellido', 50), ('telefono', 25), ('correo', 100), ('mensaje', 1000)]:
            value = data.get(key, '')
            if not isinstance(value, str) or len(value.strip()) > maximum or (key != 'mensaje' and not value.strip()):
                return jsonify(error=f'Campo inválido: {key}.'), 400
            fields[key] = value.strip()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', fields['correo']):
            return jsonify(error='El correo no tiene un formato válido.'), 400
        try:
            property_id = int(data['inmueble_id']) if data.get('inmueble_id') else None
        except (TypeError, ValueError):
            return jsonify(error='Propiedad inválida.'), 400
        with Session(engine) as s:
            if property_id is not None and s.get(Inmueble, property_id) is None:
                return jsonify(error='La propiedad no existe.'), 404
            finance = data.get('financiamiento')
            bank = None
            if finance is not None:
                try:
                    bank = s.get(Banco, int(finance['banco_id']))
                    months = int(finance['plazo_meses'])
                    down = Decimal(str(finance['enganche_porcentaje']))
                    if bank is None or property_id is None or months not in (120, 180, 240, 300) or not down.is_finite() or not 10 <= down <= 80:
                        raise ValueError
                except (KeyError, TypeError, ValueError, InvalidOperation, OverflowError):
                    return jsonify(error='Los datos de la simulación no son válidos.'), 400
            buyer = Comprador(nombre=fields['nombre'], apellido=fields['apellido'], telefono=fields['telefono'])
            s.add(buyer)
            s.flush()
            record = Solicitud(comprador_id=buyer.id_comprador, inmueble_id=property_id, correo=fields['correo'], mensaje=fields['mensaje'], fecha=datetime.now(timezone.utc).replace(tzinfo=None), estado='Pendiente')
            s.add(record)
            loan = None
            if finance is not None:
                prop = s.get(Inmueble, property_id)
                loan = Prestamo(banco_id=bank.id_banco, comprador_id=buyer.id_comprador, inmueble_id=property_id, monto_prestado=(prop.precio * (1 - down / 100)).quantize(Decimal('.01')), tasa_interes=bank.tasa_interes_base, plazo_meses=months, estado='Simulacion', fecha_desembolso=None)
                s.add(loan)
            s.commit()
            return jsonify(id_solicitud=record.id_solicitud, comprador_id=buyer.id_comprador, estado=record.estado, prestamo=serialize(loan) if loan else None), 201

    @app.post('/api/prestamos')
    def create_loan():
        # Guarda una simulación, nunca un préstamo aprobado ni desembolsado.
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error='Se requiere un objeto JSON.'), 400
        try:
            ids = {key: int(data[key]) for key in ('banco_id', 'comprador_id', 'inmueble_id')}
            months = int(data['plazo_meses'])
            down = Decimal(str(data['enganche_porcentaje']))
            if months not in (120, 180, 240, 300) or not down.is_finite() or not 10 <= down <= 80:
                raise ValueError
        except (KeyError, TypeError, ValueError, InvalidOperation, OverflowError):
            return jsonify(error='Revisa banco, comprador, inmueble, plazo y enganche.'), 400
        with Session(engine) as s:
            bank = s.get(Banco, ids['banco_id'])
            buyer = s.get(Comprador, ids['comprador_id'])
            prop = s.get(Inmueble, ids['inmueble_id'])
            if bank is None or buyer is None or prop is None:
                return jsonify(error='El banco, comprador o inmueble no existe.'), 404
            record = Prestamo(**ids, monto_prestado=(prop.precio * (1 - down / 100)).quantize(Decimal('.01')), tasa_interes=bank.tasa_interes_base, plazo_meses=months, estado='Simulacion', fecha_desembolso=None)
            s.add(record)
            s.commit()
            return jsonify(serialize(record)), 201

    @app.cli.command('init-db')
    def init_db():
        """Crea tablas faltantes en un esquema nuevo. No migra tablas existentes."""
        Base.metadata.create_all(engine)
        click.echo('Tablas creadas/verificadas. Las tablas existentes no fueron alteradas.')

    @app.cli.command('seed-demo')
    def seed():
        """Carga el catálogo ilustrativo si aún no hay inmuebles."""
        seed_demo(engine)
        click.echo('Catálogo de demostración disponible; inventario previo conservado.')

    @app.cli.command('check-db')
    def check_db():
        """Comprueba conexión y acceso al esquema sin modificarlo."""
        with engine.connect() as connection:
            connection.execute(text('SELECT 1 FROM DUAL' if app.config['DB_MODE'] == 'oracle' else 'SELECT 1'))
        with Session(engine) as s:
            s.scalars(select(Banco).limit(1)).all()
            s.scalars(select(Inmueble).limit(1)).all()
        click.echo(f'Conexión y esquema correctos ({app.config["DB_MODE"]}).')

    return app


if __name__ == '__main__':
    create_app().run(host=os.getenv('HOST', '127.0.0.1'), port=int(os.getenv('PORT', '5000')), debug=False)
