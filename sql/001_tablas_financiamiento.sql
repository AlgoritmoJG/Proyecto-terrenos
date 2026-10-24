-- MySQL 8.4 / InnoDB. Seleccionar previamente la base de datos destino.
-- Requiere comprador(id_comprador) e inmueble(id_inmueble), INT con signo
-- e índices PRIMARY KEY o UNIQUE. Las tablas padre deben usar InnoDB.
-- No elimina ni reemplaza tablas existentes. Ejecutar una sola vez.

CREATE TABLE banco (
    id_banco INT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    nit VARCHAR(20),
    telefono VARCHAR(25),
    direccion VARCHAR(255),
    tasa_interes_base DECIMAL(7,4),
    PRIMARY KEY (id_banco),
    CONSTRAINT uq_banco_nit UNIQUE (nit)
) ENGINE=InnoDB;

CREATE TABLE prestamo (
    id_prestamo INT NOT NULL AUTO_INCREMENT,
    monto_prestado DECIMAL(15,2),
    tasa_interes DECIMAL(7,4),
    plazo_meses INT,
    fecha_desembolso DATE,
    estado VARCHAR(30),
    banco_id INT,
    comprador_id INT,
    inmueble_id INT,
    PRIMARY KEY (id_prestamo),
    CONSTRAINT fk_prestamo_banco FOREIGN KEY (banco_id)
        REFERENCES banco (id_banco) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_prestamo_comprador FOREIGN KEY (comprador_id)
        REFERENCES comprador (id_comprador) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_prestamo_inmueble FOREIGN KEY (inmueble_id)
        REFERENCES inmueble (id_inmueble) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE caracteristicas_inmueble (
    id_caracteristica INT NOT NULL AUTO_INCREMENT,
    num_habitaciones INT,
    num_banos INT,
    num_parqueaderos INT,
    estrato INT,
    piso INT,
    estado_conservacion VARCHAR(30),
    inmueble_id INT NOT NULL,
    PRIMARY KEY (id_caracteristica),
    CONSTRAINT uq_caracteristicas_inmueble UNIQUE (inmueble_id),
    CONSTRAINT fk_caracteristicas_inmueble FOREIGN KEY (inmueble_id)
        REFERENCES inmueble (id_inmueble) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
