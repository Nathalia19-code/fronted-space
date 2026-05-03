document.addEventListener('DOMContentLoaded', () => {

    /* =========================================================
       0. SISTEMA DE NAVEGACIÓN (RUTAS)
       ========================================================= */
    const views = {
        home: document.getElementById('home-view'),
        search: document.getElementById('search-results-view'),
        itinerary: document.getElementById('itinerary-view'),
        trips: document.getElementById('trips-view'),
        favorites: document.getElementById('favorites-view'),
        settings: document.getElementById('settings-view')
    };

    // Función maestra para cambiar de pantalla
    function showView(viewName) {
        // Ocultar todas las pantallas
        Object.values(views).forEach(view => {
            if(view) view.style.display = 'none';
        });
        // Mostrar solo la solicitada
        if(views[viewName]) {
            views[viewName].style.display = 'block';
        }
    }

    /* =========================================================
       1. DESPLEGABLE: CREAR ITINERARIO
       ========================================================= */
    const btnCreate = document.getElementById('btn-create');
    const itineraryDropdown = document.getElementById('itinerary-dropdown');

    if (btnCreate && itineraryDropdown) {
        btnCreate.addEventListener('click', (event) => {
            event.stopPropagation();
            itineraryDropdown.classList.toggle('show');
            btnCreate.classList.toggle('active');
        });

        document.addEventListener('click', (event) => {
            if (!btnCreate.contains(event.target) && !itineraryDropdown.contains(event.target)) {
                itineraryDropdown.classList.remove('show');
                btnCreate.classList.remove('active');
            }
        });
    }

    /* =========================================================
       2. MENÚ LATERAL Y NAVEGACIÓN
       ========================================================= */
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    
    // Función para cambiar la clase activa visualmente
    function setActiveNav(clickedItem) {
        navItems.forEach(nav => nav.classList.remove('active'));
        clickedItem.classList.add('active');
    }

    document.getElementById('nav-home')?.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav(e.currentTarget);
        showView('home');
    });

    document.getElementById('nav-favorites')?.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav(e.currentTarget);
        showView('favorites');
    });

    document.getElementById('nav-trips')?.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav(e.currentTarget);
        showView('trips');
    });

    document.getElementById('nav-settings')?.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav(e.currentTarget);
        showView('settings');
    });

    // Delegación de eventos para los botones de Favoritos (Corazones)
    document.body.addEventListener('click', (event) => {
        const btn = event.target.closest('.btn-favorite');
        if (btn) {
            event.preventDefault();
            event.stopPropagation(); // Evita que abra el modal si está dentro de una oferta
            
            btn.classList.toggle('favorited');
            const icon = btn.querySelector('i');
            
            if (btn.classList.contains('favorited')) {
                btn.style.color = '#ef4444';
                if(icon) icon.classList.add('ph-fill');
            } else {
                btn.style.color = 'var(--text-secondary)';
                if(icon) icon.classList.remove('ph-fill');
            }
        }
    });

    /* =========================================================
       3. NAVEGACIÓN: HOME <-> ITINERARIO (INDIVIDUAL VS GRUPAL)
       ========================================================= */
    const btnPersonalTrip = document.getElementById('btn-new-personal-trip');
    const btnGroupTrip = document.getElementById('btn-new-group-trip');
    const collabBar = document.getElementById('collaborators-bar');

    function openEditor(isGroup) {
        showView('itinerary');
        itineraryDropdown.classList.remove('show');
        btnCreate.classList.remove('active');
        
        if (isGroup) {
            collabBar.style.display = 'flex';
        } else {
            collabBar.style.display = 'none';
        }

        // Marcar "Mis Itinerarios" en el menú lateral
        const tripsNav = document.getElementById('nav-trips');
        if(tripsNav) setActiveNav(tripsNav);
    }

    if (btnPersonalTrip) btnPersonalTrip.addEventListener('click', (e) => { e.preventDefault(); openEditor(false); });
    if (btnGroupTrip) btnGroupTrip.addEventListener('click', (e) => { e.preventDefault(); openEditor(true); });


    /* =========================================================
       PESTAÑAS DE FILTROS Y BARRAS DE PRECIO
       ========================================================= */
    const searchTabs = document.querySelectorAll('.tab-btn');
    const filterPanels = document.querySelectorAll('.filter-panel');

    // Cambiar de pestaña (Vuelos, Alojamientos, Actividades)
    searchTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            // Quitamos la clase 'active' a todos
            searchTabs.forEach(t => t.classList.remove('active'));
            filterPanels.forEach(p => p.classList.remove('active'));
            
            // Activamos el que hemos pulsado
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Actualizar los números de precio en tiempo real al mover la barra
    const ranges = [
        { slider: 'price-range-flights', valText: 'price-val-flights' },
        { slider: 'price-range-hotels', valText: 'price-val-hotels' },
        { slider: 'price-range-activities', valText: 'price-val-activities' }
    ];

    ranges.forEach(r => {
        const slider = document.getElementById(r.slider);
        const valText = document.getElementById(r.valText);
        if(slider && valText) {
            slider.addEventListener('input', (e) => {
                valText.textContent = e.target.value;
            });
        }
    });

    /* =========================================================
       4. BUSCADOR (Muestra resultados en la misma pantalla)
       ========================================================= */
    const btnBuscar = document.querySelector('.btn-buscar');
    const searchInput = document.querySelector('.search-container input');
    
    // Contenedores a ocultar/mostrar
    const defaultHomeContent = document.getElementById('default-home-content');
    const inlineSearchResults = document.getElementById('inline-search-results');
    const inlineSearchTitle = document.getElementById('inline-search-title');
    
    if (btnBuscar && searchInput) {
        btnBuscar.addEventListener('click', () => {
            const destino = searchInput.value.trim();
            
            if (destino !== '') {
                // Actualizar título de resultados
                if (inlineSearchTitle) {
                    inlineSearchTitle.textContent = `Resultados para "${destino}"`;
                }
                
                // Ocultar ofertas y mostrar resultados
                if (defaultHomeContent) defaultHomeContent.style.display = 'none';
                if (inlineSearchResults) inlineSearchResults.style.display = 'block';
                
            } else {
                alert('Por favor, escribe una ciudad o país primero.');
            }
        });

        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                btnBuscar.click();
            }
        });
    }

    // Si le das a "Explorar" en el menú lateral, limpiamos la búsqueda y volvemos al inicio normal
    const navHomeExtra = document.getElementById('nav-home');
    if (navHomeExtra) {
        navHomeExtra.addEventListener('click', () => {
             if(defaultHomeContent) defaultHomeContent.style.display = 'block';
             if(inlineSearchResults) inlineSearchResults.style.display = 'none';
             if(searchInput) searchInput.value = ''; 
        });
    }

    /* =========================================================
       5. MODAL DE OFERTAS DESTACADAS
       ========================================================= */
    const offerModal = document.getElementById('offer-modal');
    const closeOfferModal = document.getElementById('close-modal');
    const offerCards = document.querySelectorAll('.offer-card');

    // Abrir modal al hacer clic en cualquier tarjeta de oferta
    offerCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Asegurarse de que no abra el modal si el usuario hizo clic en el corazón
            if(!e.target.closest('.btn-favorite')) {
                offerModal.style.display = 'flex';
            }
        });
    });

    // Cerrar modal al darle a la X
    if (closeOfferModal) {
        closeOfferModal.addEventListener('click', () => {
            offerModal.style.display = 'none';
        });
    }

    // Cerrar modal si el usuario hace clic fuera de la caja blanca
    if (offerModal) {
        offerModal.addEventListener('click', (e) => {
            if(e.target === offerModal) {
                offerModal.style.display = 'none';
            }
        });
    }

    /* =========================================================
       6. CREADOR DINÁMICO DE BLOQUES EN EL EDITOR
       ========================================================= */
    const blocksContainer = document.getElementById('blocks-container');
    const insertButtons = document.querySelectorAll('.btn-insert-block');
    let dayCounter = 1;

    insertButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-type');
            const newBlock = document.createElement('div');
            newBlock.className = 'itinerary-block';

            let innerHTML = `<div class="block-controls"><i class="ph ph-dots-six-vertical drag-handle"></i></div><div class="block-content">`;

            if (type === 'text') {
                dayCounter++;
                innerHTML += `
                    <h2 contenteditable="true" data-placeholder="Día ${dayCounter}: [Escribe aquí]">Día ${dayCounter}: </h2>
                    <p contenteditable="true" data-placeholder="Añade notas o ideas..."></p>
                `;
            } else if (type === 'flight') {
                innerHTML += `
                    <div class="mock-block mock-flight">
                        <div class="mock-icon"><i class="ph ph-airplane-tilt"></i></div>
                        <div class="mock-details">
                            <h4 contenteditable="true" data-placeholder="Detalles del Vuelo (Ej: Iberia IB3130)"></h4>
                            <p contenteditable="true" data-placeholder="Horarios, terminal, localizador..."></p>
                        </div>
                        <div class="mock-action">Vincular BD</div>
                    </div>
                `;
            } else if (type === 'hotel') {
                innerHTML += `
                    <div class="mock-block mock-hotel">
                        <div class="mock-icon"><i class="ph ph-buildings"></i></div>
                        <div class="mock-details">
                            <h4 contenteditable="true" data-placeholder="Nombre del Alojamiento"></h4>
                            <p contenteditable="true" data-placeholder="Dirección, check-in, notas..."></p>
                        </div>
                        <div class="mock-action">Vincular BD</div>
                    </div>
                `;
            } else if (type === 'route') {
                innerHTML += `
                    <div class="mock-block mock-route">
                        <div class="mock-icon"><i class="ph ph-map-pin-line"></i></div>
                        <div class="mock-details">
                            <h4 contenteditable="true" data-placeholder="Lugar a visitar o ruta"></h4>
                            <p contenteditable="true" data-placeholder="Añade una descripción o precio de entrada..."></p>
                        </div>
                        <div class="mock-action">Añadir mapa</div>
                    </div>
                `;
            }

            innerHTML += `</div>`;
            newBlock.innerHTML = innerHTML;
            blocksContainer.appendChild(newBlock);
            
            // Auto-focus en el nuevo bloque creado
            const firstEditable = newBlock.querySelector('[contenteditable="true"]');
            if (firstEditable) firstEditable.focus();
        });
    });

});