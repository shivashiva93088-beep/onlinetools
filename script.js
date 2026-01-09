document.addEventListener('DOMContentLoaded', function() {
    
    // === 1. Hamburger Menu & Body Scroll Lock ===
    const hamburger = document.getElementById('hamburger-menu');
    const mobileNav = document.getElementById('mobile-nav-panel');
    const closeBtn = document.getElementById('close-btn');
    const bodyEl = document.querySelector('body');
    
    function openMobileMenu() {
        if (mobileNav) mobileNav.style.display = 'block';
        if (bodyEl) bodyEl.classList.add('mobile-menu-open');
    }
    
    function closeMobileMenu() {
        if (bodyEl) bodyEl.classList.remove('mobile-menu-open');
    }
    
    if (hamburger) { hamburger.addEventListener('click', openMobileMenu); }
    if (closeBtn) { closeBtn.addEventListener('click', closeMobileMenu); }

    // === 2. Mobile Menu Submenu Toggle ===
    const mobileDropdownToggles = document.querySelectorAll('.mobile-main-nav .mobile-dropdown-submenu > a');
    mobileDropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(event) {
            event.preventDefault();
            const submenu = this.nextElementSibling;
            if (submenu) { submenu.style.display = (submenu.style.display === 'block') ? 'none' : 'block'; }
        });
    });

    // === 3. Live Tool Search (Global) ---
    const categoryTabsContainer = document.querySelector('.category-tabs');
    const allSubcategoryFilters = document.querySelectorAll('.subcategory-filters');
    const allTabContents = document.querySelectorAll('.tab-content');
    const allToolCards = document.querySelectorAll('.tool-card');

    function setupToolSearch(inputId) {
        const searchInput = document.getElementById(inputId);
        if (!searchInput || allToolCards.length === 0) return;

        function filterAndScroll() {
            const searchTerm = searchInput.value.toLowerCase();
            let firstMatchFound = false;

            if (searchTerm !== "") {
                // Search is active
                if (categoryTabsContainer) categoryTabsContainer.style.display = 'none';
                allSubcategoryFilters.forEach(filter => filter.style.display = 'none');
                allTabContents.forEach(tab => tab.style.display = 'block'); // Show ALL tabs to search in them

                allToolCards.forEach(function(card) {
                    const title = card.querySelector('h3') ? card.querySelector('h3').textContent.toLowerCase() : '';
                    const description = card.querySelector('p') ? card.querySelector('p').textContent.toLowerCase() : '';
                    
                    const isVisible = title.includes(searchTerm) || description.includes(searchTerm);
                    card.style.display = isVisible ? 'block' : 'none';

                    if (isVisible && !firstMatchFound) {
                        card.scrollIntoView({ behavior: 'instant', block: 'center' });
                        firstMatchFound = true;
                    }
                });
            } else {
                // Search is empty, restore normal view
                if (categoryTabsContainer) categoryTabsContainer.style.display = 'flex';
                allSubcategoryFilters.forEach(filter => filter.style.display = 'flex');
                
                allToolCards.forEach(card => card.style.display = 'block'); 

                allTabContents.forEach(tab => {
                    if (tab.classList.contains('active')) {
                        tab.style.display = 'block';
                        if (typeof handlePagination === 'function') {
                            handlePagination(tab);
                        }
                    } else {
                        tab.style.display = 'none';
                    }
                });
            }
        }

        searchInput.addEventListener('keyup', filterAndScroll);

        searchInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (inputId === 'mobileToolSearchInput' && mobileNav) { closeMobileMenu(); }
            }
        });
    }
    setupToolSearch('toolSearchInput');
    setupToolSearch('mobileToolSearchInput');

    // === 4. Advanced Category Section ---
    const itemsPerPage = 8;
    const itemsToLoad = 4;
    const tabButtons = document.querySelectorAll('.tab-button');

    tabButtons.forEach(button => { button.addEventListener('click', openCategory); });
    
    document.querySelectorAll('.subcat-link').forEach(button => {
        button.addEventListener('click', (event) => {
            const filter = event.target.dataset.filter;
            const tabContent = event.target.closest('.tab-content');
            tabContent.querySelectorAll('.subcat-link').forEach(link => link.classList.remove('active'));
            event.target.classList.add('active');
            tabContent.querySelectorAll('.tools-grid .tool-card').forEach(card => {
                card.style.display = (filter === 'all' || card.dataset.category === filter) ? 'block' : 'none';
            });
            handlePagination(tabContent);
        });
    });
    document.querySelectorAll('.load-more-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const tabContent = event.target.closest('.tab-content');
            const hiddenCards = tabContent.querySelectorAll('.tools-grid .tool-card.hidden:not([style*="display: none"])');
            for (let i = 0; i < itemsToLoad; i++) { if (hiddenCards[i]) hiddenCards[i].classList.remove('hidden'); }
            if (tabContent.querySelectorAll('.tools-grid .tool-card.hidden:not([style*="display: none"])').length === 0) { event.target.style.display = 'none'; }
        });
    });
    function openCategory(evt) {
        const categoryId = evt.currentTarget.dataset.tab;
        allTabContents.forEach(tc => tc.style.display = 'none');
        tabButtons.forEach(tl => tl.classList.remove('active'));
        const activeTab = document.getElementById(categoryId);
        if (activeTab) {
            activeTab.style.display = 'block';
            evt.currentTarget.classList.add('active');
            handlePagination(activeTab);
        }
    }
    function handlePagination(tabContent) {
        const loadMoreBtn = tabContent.querySelector('.load-more-btn');
        if (!loadMoreBtn) return;
        const visibleCards = tabContent.querySelectorAll('.tools-grid .tool-card:not([style*="display: none"])');
        visibleCards.forEach((card, index) => {
            card.classList.add('hidden');
            if (index < itemsPerPage) card.classList.remove('hidden');
        });
        const hiddenCardsCount = tabContent.querySelectorAll('.tools-grid .tool-card.hidden:not([style*="display: none"])').length;
        loadMoreBtn.style.display = hiddenCardsCount > 0 ? 'block' : 'none';
    }
    
    allTabContents.forEach(tc => {
        if(!tc.classList.contains('active')) {
            tc.style.display = 'none';
        }
    });
    const defaultActiveTab = document.querySelector('.tab-content.active');
    if (defaultActiveTab) {
        handlePagination(defaultActiveTab);
    }

    // --- 5. Copyright Year ---
    const yearSpan = document.getElementById('copyright-year');
    if(yearSpan) { yearSpan.textContent = new Date().getFullYear(); }
});