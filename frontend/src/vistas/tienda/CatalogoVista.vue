<script setup>
// RF 02 y 5.1: catálogo público de motos Disponibles con filtros por marca, cilindrada y precio,
// y los accesorios a la venta. Los filtros viven en la URL para poder compartir la búsqueda.
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { tienda } from '../../api/tienda.js';
import { agregarAccesorio, carrito } from '../../estado/carrito.js';
import { formatearQuetzales } from '../../logica/formato.js';
import TarjetaMoto from '../../componentes/TarjetaMoto.vue';
import AvisoError from '../../componentes/AvisoError.vue';

const route = useRoute();
const router = useRouter();
const POR_PAGINA = 12;
const CAMPOS = ['marcaId', 'cilindradaMin', 'cilindradaMax', 'precioMin', 'precioMax'];

const filtros = reactive(Object.fromEntries(CAMPOS.map((c) => [c, route.query[c] ?? ''])));
const marcas = ref([]);
const accesorios = ref([]);
const resultado = ref({ motocicletas: [], total: 0 });
const cargando = ref(false);
const error = ref(null);
const pagina = computed(() => Number(route.query.pagina ?? 1));
const paginas = computed(() => Math.max(1, Math.ceil(resultado.value.total / POR_PAGINA)));
const hayFiltros = computed(() => CAMPOS.some((c) => route.query[c]));

async function buscar() {
  cargando.value = true;
  error.value = null;
  try {
    resultado.value = await tienda.listarMotos({ ...route.query, porPagina: POR_PAGINA });
  } catch (e) {
    error.value = e;
  } finally {
    cargando.value = false;
  }
}

function aplicar(nuevaPagina = 1) {
  const query = Object.fromEntries(CAMPOS.filter((c) => filtros[c] !== '').map((c) => [c, filtros[c]]));
  if (nuevaPagina > 1) query.pagina = nuevaPagina;
  router.push({ query });
}

function limpiar() {
  CAMPOS.forEach((c) => { filtros[c] = ''; });
  aplicar();
}

const enCarrito = (id) => carrito.value.accesorios.find((a) => a.id === id)?.cantidad ?? 0;

watch(() => route.query, buscar);
onMounted(async () => {
  buscar();
  try {
    [marcas.value, accesorios.value] = await Promise.all([
      tienda.listarMarcas().then((r) => r.marcas),
      tienda.listarAccesorios().then((r) => r.accesorios),
    ]);
  } catch (e) {
    error.value ??= e;
  }
});
</script>

<template>
  <section class="mb-8">
    <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Motocicletas nuevas</h1>
    <p class="mt-2 text-zinc-600">Unidades disponibles hoy, cada una con su número de chasis (VIN). Precios en quetzales con IVA incluido.</p>
  </section>

  <div class="grid gap-6 lg:grid-cols-[16rem_1fr]">
    <aside>
      <form class="tarjeta space-y-4 p-5 lg:sticky lg:top-24" @submit.prevent="aplicar()">
        <h2 class="font-bold">Filtrar</h2>
        <div>
          <label class="etiqueta" for="marca">Marca</label>
          <select id="marca" v-model="filtros.marcaId" class="campo">
            <option value="">Todas</option>
            <option v-for="m in marcas" :key="m.id" :value="String(m.id)">{{ m.nombre }}</option>
          </select>
        </div>
        <fieldset>
          <legend class="etiqueta">Cilindrada (cc)</legend>
          <div class="grid grid-cols-2 gap-2">
            <input v-model="filtros.cilindradaMin" class="campo" type="number" min="1" inputmode="numeric" placeholder="Mín." aria-label="Cilindrada mínima" />
            <input v-model="filtros.cilindradaMax" class="campo" type="number" min="1" inputmode="numeric" placeholder="Máx." aria-label="Cilindrada máxima" />
          </div>
        </fieldset>
        <fieldset>
          <legend class="etiqueta">Precio (Q)</legend>
          <div class="grid grid-cols-2 gap-2">
            <input v-model="filtros.precioMin" class="campo" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Mín." aria-label="Precio mínimo" />
            <input v-model="filtros.precioMax" class="campo" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Máx." aria-label="Precio máximo" />
          </div>
        </fieldset>
        <div class="flex gap-2">
          <button type="submit" class="boton-principal flex-1">Aplicar</button>
          <button v-if="hayFiltros" type="button" class="boton-secundario" @click="limpiar">Limpiar</button>
        </div>
      </form>
    </aside>

    <div>
      <AvisoError :error="error" class="mb-4" />
      <p class="mb-4 text-sm text-zinc-600" aria-live="polite">
        {{ cargando ? 'Buscando…' : `${resultado.total} ${resultado.total === 1 ? 'motocicleta disponible' : 'motocicletas disponibles'}` }}
      </p>

      <div v-if="!cargando && !resultado.motocicletas.length && !error" class="tarjeta p-10 text-center text-zinc-600">
        No hay motocicletas con esos filtros.
        <button v-if="hayFiltros" type="button" class="boton-texto" @click="limpiar">Ver todas</button>
      </div>

      <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" :class="{ 'opacity-60': cargando }">
        <TarjetaMoto v-for="moto in resultado.motocicletas" :key="moto.id" :moto="moto" />
      </div>

      <nav v-if="paginas > 1" class="mt-6 flex items-center justify-center gap-3" aria-label="Páginas">
        <button type="button" class="boton-secundario" :disabled="pagina <= 1" @click="aplicar(pagina - 1)">Anterior</button>
        <span class="text-sm text-zinc-600">Página {{ pagina }} de {{ paginas }}</span>
        <button type="button" class="boton-secundario" :disabled="pagina >= paginas" @click="aplicar(pagina + 1)">Siguiente</button>
      </nav>

      <section v-if="accesorios.length" class="mt-12">
        <h2 class="mb-4 text-2xl font-extrabold tracking-tight">Accesorios</h2>
        <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <li v-for="a in accesorios" :key="a.id" class="tarjeta flex flex-col gap-2 p-5">
            <p class="text-xs font-semibold tracking-wider text-zinc-500 uppercase">{{ a.sku }}</p>
            <p class="font-bold">{{ a.nombre }}</p>
            <p v-if="a.descripcion" class="text-sm text-zinc-600">{{ a.descripcion }}</p>
            <p class="mt-auto text-xl font-extrabold">{{ formatearQuetzales(a.precio) }}</p>
            <p class="text-xs text-zinc-500">{{ a.stock > 0 ? `${a.stock} en existencia` : 'Agotado' }}</p>
            <button type="button" class="boton-secundario" :disabled="a.stock === 0 || enCarrito(a.id) >= a.stock" @click="agregarAccesorio(a)">
              {{ enCarrito(a.id) ? `En el carrito (${enCarrito(a.id)}) · Agregar otro` : 'Agregar al carrito' }}
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
