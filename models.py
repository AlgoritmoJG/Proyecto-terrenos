"""Modelo relacional del proyecto. Compatible con Oracle 12c+ y SQLite demo."""
from sqlalchemy import Date, DateTime, ForeignKey, Identity, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def pk():
    return mapped_column(Integer, Identity(), primary_key=True)


class Banco(Base):
    __tablename__ = 'banco'
    id_banco: Mapped[int] = pk()
    nombre = mapped_column(String(100), nullable=False)
    nit = mapped_column(String(20), unique=True)
    telefono = mapped_column(String(25))
    direccion = mapped_column(String(255))
    tasa_interes_base = mapped_column(Numeric(7, 4))


class Comprador(Base):
    __tablename__ = 'comprador'
    id_comprador: Mapped[int] = pk()
    nombre = mapped_column(String(50), nullable=False)
    apellido = mapped_column(String(50), nullable=False)
    direccion = mapped_column(String(150))
    telefono = mapped_column(String(25))
    estado_civil = mapped_column(String(30))
    nacionalidad = mapped_column(String(50))
    edad = mapped_column(Integer)


class Vendedor(Base):
    __tablename__ = 'vendedor'
    id_vendedor: Mapped[int] = pk()
    nombre = mapped_column(String(50), nullable=False)
    apellido = mapped_column(String(50))
    direccion = mapped_column(String(150))
    telefono = mapped_column(String(25))


class Agente(Base):
    __tablename__ = 'agente'
    id_agente: Mapped[int] = pk()
    codigo_agente = mapped_column(Integer, unique=True)
    nombre = mapped_column(String(50), nullable=False)
    apellido = mapped_column(String(50))
    direccion = mapped_column(String(255))
    antiguedad_empresa = mapped_column(Integer)


class TipoInmueble(Base):
    __tablename__ = 'tipo_inmueble'
    id_tipo_inmueble: Mapped[int] = pk()
    nombre_tipo = mapped_column(String(255), nullable=False)


class Inmueble(Base):
    __tablename__ = 'inmueble'
    id_inmueble: Mapped[int] = pk()
    direccion = mapped_column(String(200), nullable=False)
    precio = mapped_column(Numeric(15, 2), nullable=False)
    antiguedad = mapped_column(Integer)
    modelo = mapped_column(String(100))
    material = mapped_column(String(100))
    metraje = mapped_column(Numeric(12, 2))
    estado = mapped_column(String(30))
    disponibilidad = mapped_column(String(30))
    vendedor_id = mapped_column(ForeignKey('vendedor.id_vendedor'), index=True)
    tipo_inmueble_id = mapped_column(ForeignKey('tipo_inmueble.id_tipo_inmueble'), index=True)
    agente_id = mapped_column(ForeignKey('agente.id_agente'), index=True)
    # Campos de presentación añadidos para el catálogo web.
    nombre = mapped_column(String(100), nullable=False)
    ciudad = mapped_column(String(100), nullable=False)
    descripcion = mapped_column(String(2000))
    imagen = mapped_column(String(100))
    destacado = mapped_column(Integer, default=0, nullable=False)
    tipo = relationship(TipoInmueble)
    vendedor = relationship(Vendedor)
    agente = relationship(Agente)
    caracteristicas = relationship('CaracteristicasInmueble', uselist=False, passive_deletes='all')


class CaracteristicasInmueble(Base):
    __tablename__ = 'caracteristicas_inmueble'
    id_caracteristica: Mapped[int] = pk()
    num_habitaciones = mapped_column(Integer)
    num_banos = mapped_column(Integer)
    num_parqueaderos = mapped_column(Integer)
    estrato = mapped_column(Integer)
    piso = mapped_column(Integer)
    estado_conservacion = mapped_column(String(30))
    inmueble_id = mapped_column(ForeignKey('inmueble.id_inmueble'), nullable=False, unique=True)


class Prestamo(Base):
    __tablename__ = 'prestamo'
    id_prestamo: Mapped[int] = pk()
    monto_prestado = mapped_column(Numeric(15, 2), nullable=False)
    tasa_interes = mapped_column(Numeric(7, 4), nullable=False)
    plazo_meses = mapped_column(Integer, nullable=False)
    fecha_desembolso = mapped_column(Date)
    estado = mapped_column(String(30), nullable=False)
    banco_id = mapped_column(ForeignKey('banco.id_banco'), nullable=False, index=True)
    comprador_id = mapped_column(ForeignKey('comprador.id_comprador'), nullable=False, index=True)
    inmueble_id = mapped_column(ForeignKey('inmueble.id_inmueble'), nullable=False, index=True)


class Oferta(Base):
    __tablename__ = 'oferta'
    id_oferta: Mapped[int] = pk()
    monto = mapped_column(Numeric(15, 2))
    forma_pago = mapped_column(String(50))
    tiempo_pago = mapped_column(String(100))
    fecha = mapped_column(Date)
    hora = mapped_column(DateTime)
    estado = mapped_column(String(30))
    comprador_id = mapped_column(ForeignKey('comprador.id_comprador'), index=True)
    inmueble_id = mapped_column(ForeignKey('inmueble.id_inmueble'), index=True)


class ContraOferta(Base):
    __tablename__ = 'contra_oferta'
    id_contra_oferta: Mapped[int] = pk()
    monto = mapped_column(Numeric(15, 2))
    fecha = mapped_column(Date)
    hora = mapped_column(DateTime)
    estado = mapped_column(String(30))
    oferta_id = mapped_column(ForeignKey('oferta.id_oferta'), index=True)


class Acuerdo(Base):
    __tablename__ = 'acuerdo'
    id_acuerdo: Mapped[int] = pk()
    fecha = mapped_column(Date)
    monto_acordado = mapped_column(Numeric(15, 2))
    condiciones = mapped_column(String(500))
    estado = mapped_column(String(30))
    oferta_id = mapped_column(ForeignKey('oferta.id_oferta'), index=True)


class Compra(Base):
    __tablename__ = 'compra'
    id_compra: Mapped[int] = pk()
    fecha_compra = mapped_column(Date)
    monto_final = mapped_column(Numeric(15, 2))
    forma_pago = mapped_column(String(50))
    acuerdo_id = mapped_column(ForeignKey('acuerdo.id_acuerdo'), index=True)


class Solicitud(Base):
    """Extensión web: datos de contacto y visita, sin alterar comprador."""
    __tablename__ = 'solicitud'
    id_solicitud: Mapped[int] = pk()
    comprador_id = mapped_column(ForeignKey('comprador.id_comprador'), nullable=False, index=True)
    inmueble_id = mapped_column(ForeignKey('inmueble.id_inmueble'), index=True)
    correo = mapped_column(String(100), nullable=False)
    mensaje = mapped_column(String(1000))
    fecha = mapped_column(DateTime, nullable=False)
    estado = mapped_column(String(30), nullable=False)
