(function () {
    function getMenuElements() {
        return {
            body: document.body,
            button: document.querySelector('.header-menu-btn'),
            nav: document.querySelector('.header-nav')
        };
    }

    function syncMenu(open) {
        var parts = getMenuElements();
        if (!parts.button || !parts.nav || !parts.body) {
            return;
        }

        parts.button.classList.toggle('open', open);
        parts.button.setAttribute('aria-expanded', open ? 'true' : 'false');
        parts.nav.classList.toggle('open', open);
        parts.body.classList.toggle('menu-open', open);
    }

    window.toggleMenu = function toggleMenu() {
        var parts = getMenuElements();
        if (!parts.button) {
            return;
        }
        syncMenu(!parts.button.classList.contains('open'));
    };

    function closeMenu() {
        syncMenu(false);
    }

    document.addEventListener('click', function (event) {
        if (!event.target.closest('.header-nav a')) {
            return;
        }
        closeMenu();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeMenu();
        }
    });

    window.addEventListener('resize', function () {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    });
})();
