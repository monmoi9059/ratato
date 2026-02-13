global.document = {
    getElementById: (id) => {
        if (id === 'gameCanvas') {
            return {
                getContext: () => ({
                    // minimal mock for context
                    beginPath: () => {},
                    arc: () => {},
                    fill: () => {},
                    stroke: () => {},
                    save: () => {},
                    restore: () => {},
                    fillRect: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    fillStyle: '',
                    strokeStyle: '',
                    lineWidth: 1,
                    measureText: () => ({ width: 0 }),
                    fillText: () => {},
                    font: '',
                    textAlign: '',
                    textBaseline: '',
                    globalAlpha: 1,
                    translate: () => {},
                    rotate: () => {},
                    scale: () => {},
                    closePath: () => {},
                    createLinearGradient: () => ({ addColorStop: () => {} }),
                    createRadialGradient: () => ({ addColorStop: () => {} }),
                    clearRect: () => {},
                    setTransform: () => {},
                    transform: () => {},
                    clip: () => {},
                    isPointInPath: () => false,
                    isPointInStroke: () => false,
                    getImageData: () => ({ data: [] }),
                    putImageData: () => {},
                    drawImage: () => {},
                }),
                width: 800,
                height: 600,
                addEventListener: () => {}
            };
        }
        // return generic element mock
        return {
            classList: { add: () => {}, remove: () => {} },
            innerHTML: '',
            appendChild: () => {},
            textContent: '',
            style: {},
            value: '',
            addEventListener: () => {},
            removeEventListener: () => {},
            getAttribute: () => '',
            setAttribute: () => {},
            removeAttribute: () => {},
            getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
        };
    },
    createElement: () => ({
        className: '',
        innerHTML: '',
        onclick: null,
        appendChild: () => {},
        style: {},
        classList: { add: () => {}, remove: () => {} },
        setAttribute: () => {},
        getAttribute: () => '',
        addEventListener: () => {},
    }),
    body: {
        appendChild: () => {},
        innerHTML: '',
        style: {},
    },
    head: {
        appendChild: () => {},
    },
};

global.window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    localStorage: {
        getItem: () => '0',
        setItem: () => {}
    },
    location: {
        href: '',
        reload: () => {},
    },
    alert: () => {},
    confirm: () => true,
    prompt: () => '',
};

global.localStorage = global.window.localStorage;
global.Image = class {
    constructor() {
        this.src = '';
        this.onload = null;
    }
};
