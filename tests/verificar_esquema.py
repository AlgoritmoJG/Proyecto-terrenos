"""Prueba de integración del DDL en un MySQL temporal sin puertos publicados."""
from pathlib import Path
import subprocess
import time
import uuid


def run(*args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, **kwargs)


name = 'terrenos-test-' + uuid.uuid4().hex[:12]


def sql(statement, error=None):
    result = run('docker', 'exec', '-i', name, 'mysql', '-uroot',
                 '--batch', '--skip-column-names', 'terrenos_test', input=statement)
    if error is None:
        assert result.returncode == 0, result.stderr
    else:
        assert result.returncode != 0 and f'ERROR {error} ' in result.stderr, result.stderr
    return result.stdout.strip()


try:
    result = run('docker', 'run', '-d', '--name', name,
                 '-e', 'MYSQL_ALLOW_EMPTY_PASSWORD=yes', 'mysql:8.4')
    assert result.returncode == 0, result.stderr
    for _ in range(90):
        # Require the final server (PID 1), not the temporary initialization server.
        ready = run('docker', 'exec', name, 'sh', '-c',
                    'test "$(cat /proc/1/comm)" = mysqld && mysql -uroot -e "SELECT 1"')
        if ready.returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError('MySQL no inició: ' + run('docker', 'logs', name).stderr)
    result = run('docker', 'exec', name, 'mysql', '-uroot', '-e',
                 'CREATE DATABASE terrenos_test;')
    assert result.returncode == 0, result.stderr
    sql('CREATE TABLE comprador (id_comprador INT PRIMARY KEY) ENGINE=InnoDB;'
        'CREATE TABLE inmueble (id_inmueble INT PRIMARY KEY) ENGINE=InnoDB;')
    sql((Path(__file__).resolve().parents[1] / 'sql/001_tablas_financiamiento.sql').read_text())
    sql("INSERT INTO comprador VALUES (1); INSERT INTO inmueble VALUES (1),(2);"
        "INSERT INTO banco(nombre,nit,tasa_interes_base) VALUES ('Banco prueba','NIT-1',12.5);"
        "INSERT INTO prestamo(monto_prestado,tasa_interes,plazo_meses,fecha_desembolso,estado,"
        "banco_id,comprador_id,inmueble_id) VALUES (100000.25,12.5,120,'2026-10-24','Activo',1,1,1);"
        "INSERT INTO prestamo(banco_id,comprador_id,inmueble_id) VALUES (1,1,1);"
        "INSERT INTO caracteristicas_inmueble(num_habitaciones,num_banos,inmueble_id) VALUES (3,2,1);")
    assert sql('SELECT monto_prestado,tasa_interes FROM prestamo WHERE id_prestamo=1;') == '100000.25\t12.5000'
    assert sql('SELECT COUNT(*) FROM prestamo WHERE banco_id=1 AND comprador_id=1 AND inmueble_id=1;') == '2'
    print('OK: importación, autoincremento, decimales y relaciones N:1')
    sql("INSERT INTO banco(nombre,nit) VALUES ('Duplicado','NIT-1');", error=1062)
    sql('INSERT INTO banco(nombre) VALUES (NULL);', error=1048)
    print('OK: NIT único y nombre obligatorio')
    for column in ('banco_id', 'comprador_id', 'inmueble_id'):
        sql(f'INSERT INTO prestamo({column}) VALUES (999);', error=1452)
    sql('INSERT INTO caracteristicas_inmueble(inmueble_id) VALUES (999);', error=1452)
    print('OK: las cuatro claves foráneas rechazan referencias inexistentes')
    sql('INSERT INTO caracteristicas_inmueble(inmueble_id) VALUES (1);', error=1062)
    sql('INSERT INTO caracteristicas_inmueble(inmueble_id) VALUES (NULL);', error=1048)
    sql('INSERT INTO caracteristicas_inmueble(inmueble_id) VALUES (2);')
    print('OK: características únicas por inmueble y vínculo obligatorio')
    for table, pk in (('banco', 'id_banco'), ('comprador', 'id_comprador'), ('inmueble', 'id_inmueble')):
        sql(f'DELETE FROM {table} WHERE {pk}=1;', error=1451)
    print('OK: protección contra borrado de padres referenciados')
finally:
    run('docker', 'rm', '-fv', name)
