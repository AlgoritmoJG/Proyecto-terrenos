"""Ejecuta las pruebas contra un Oracle Free temporal y elimina su contenedor.

Requiere Docker y la imagen gvenzl/oracle-free:23-slim-faststart.
Las credenciales se generan en memoria; no se imprimen ni se escriben en archivos.
"""
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

import oracledb

ROOT = Path(__file__).resolve().parents[1]
name = 'terrena-oracle-test-' + uuid.uuid4().hex[:10]
password = 'T' + uuid.uuid4().hex + 'a9'
container_env = {**os.environ, 'ORACLE_PASSWORD': password, 'APP_USER': 'TERRENA_TEST', 'APP_USER_PASSWORD': password}


def docker(*args, **kwargs):
    return subprocess.run(['docker', *args], text=True, capture_output=True, timeout=kwargs.pop('timeout', 60), **kwargs)


try:
    start = docker('run', '-d', '--name', name, '-p', '127.0.0.1::1521', '-e', 'ORACLE_PASSWORD', '-e', 'APP_USER', '-e', 'APP_USER_PASSWORD', 'gvenzl/oracle-free:23-slim-faststart', env=container_env, timeout=240)
    if start.returncode:
        raise RuntimeError('No fue posible iniciar Oracle: ' + start.stderr)
    print('Oracle temporal iniciado; esperando a que esté disponible…', flush=True)
    for _ in range(180):
        check = docker('exec', name, 'healthcheck.sh')
        if check.returncode == 0:
            break
        time.sleep(2)
    else:
        raise RuntimeError('Oracle no alcanzó el estado disponible.')
    port = docker('port', name, '1521/tcp').stdout.strip().rsplit(':', 1)[1]
    env = {**os.environ, 'DB_MODE': 'oracle', 'TERRENA_ORACLE_TEST': '1', 'ORACLE_USER': 'TERRENA_TEST', 'ORACLE_PASSWORD': password, 'ORACLE_DSN': f'localhost:{port}/FREEPDB1'}
    # Ejecutar los archivos que usará SQL Developer, además de verificar el ORM.
    with oracledb.connect(user='TERRENA_TEST', password=password, dsn=env['ORACLE_DSN']) as connection:
        with connection.cursor() as cursor:
            cursor.execute('CREATE TABLE comprador (id_comprador INTEGER PRIMARY KEY)')
            cursor.execute('CREATE TABLE inmueble (id_inmueble INTEGER PRIMARY KEY)')
            for statement in (ROOT / 'sql/oracle/002_solo_tablas_solicitadas.sql').read_text(encoding='utf-8').split(';'):
                if statement.strip():
                    cursor.execute(statement)
            for table in ('prestamo', 'caracteristicas_inmueble', 'banco', 'comprador', 'inmueble'):
                cursor.execute(f'DROP TABLE {table} PURGE')
            for statement in (ROOT / 'sql/oracle/001_esquema_completo.sql').read_text(encoding='utf-8').split(';'):
                if statement.strip():
                    cursor.execute(statement)
    print('Ambos scripts SQL de Oracle ejecutados correctamente en esquemas de prueba.', flush=True)
    print('Oracle disponible. Ejecutando la misma suite de API y restricciones…', flush=True)
    result = subprocess.run([sys.executable, '-m', 'pytest', 'tests/test_api.py', '-q'], cwd=ROOT, env=env)
    sys.exit(result.returncode)
finally:
    docker('rm', '-fv', name)
