// svg_editor.ts
// Версия на TypeScript с использованием xml2js, строгая типизация, декораторы

import * as fs from 'fs';
import * as xml2js from 'xml2js';
import { program } from 'commander';

// Декоратор для логирования (экспериментальный)
function logMethod(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
        console.log(`[LOG] ${propertyKey} вызван с`, args);
        return original.apply(this, args);
    };
    return descriptor;
}

interface Layer {
    index: number;
    id: string;
    attrs: Record<string, string>;
    element: any; // xml2js объект
}

class SvgEditor {
    private filename: string;
    private xml: any;
    private svg: any;
    private layers: Layer[] = [];

    constructor(filename: string) {
        this.filename = filename;
    }

    @logMethod
    async load(): Promise<void> {
        const data = await fs.promises.readFile(this.filename, 'utf-8');
        const parser = new xml2js.Parser({ explicitArray: false });
        this.xml = await parser.parseStringPromise(data);
        this.svg = this.xml.svg;
        this.collectLayers();
    }

    private collectLayers(): void {
        this.layers = [];
        if (!this.svg) return;
        const children = this.svg.g || [];
        const items = Array.isArray(children) ? children : [children];
        items.forEach((elem: any, idx: number) => {
            const attrs = elem.$ || {};
            const id = attrs.id || attrs['data-layer'] || null;
            this.layers.push({ index: idx, id, attrs, element: elem });
        });
    }

    @logMethod
    listLayers(): void {
        if (this.layers.length === 0) {
            console.log('Слои не найдены.');
            return;
        }
        this.layers.forEach(l => {
            const attrsStr = Object.entries(l.attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
            console.log(`[${l.index}] ${l.id || 'без id'} : ${attrsStr}`);
        });
    }

    @logMethod
    addLayer(id: string, extraAttrs: Record<string, string>): void {
        const newGroup = { $: { id, ...extraAttrs } };
        if (!this.svg.g) {
            this.svg.g = [];
        }
        if (!Array.isArray(this.svg.g)) {
            this.svg.g = [this.svg.g];
        }
        this.svg.g.push(newGroup);
        this.collectLayers();
        console.log(`Слой '${id}' добавлен.`);
    }

    @logMethod
    removeLayer(index: number): void {
        if (index < 0 || index >= this.layers.length) {
            throw new Error('Индекс вне диапазона.');
        }
        const layers = this.svg.g;
        if (Array.isArray(layers)) {
            layers.splice(index, 1);
        } else {
            this.svg.g = null;
        }
        this.collectLayers();
        console.log(`Слой ${index} удалён.`);
    }

    @logMethod
    moveLayer(index: number, direction: 'up' | 'down'): void {
        if (index < 0 || index >= this.layers.length) {
            throw new Error('Индекс вне диапазона.');
        }
        const layers = this.svg.g;
        if (!Array.isArray(layers)) {
            throw new Error('Невозможно переместить: не массив слоёв.');
        }
        const newIdx = direction === 'up' ? index - 1 : index + 1;
        if (newIdx < 0 || newIdx >= layers.length) {
            throw new Error('Невозможно переместить в указанном направлении.');
        }
        [layers[index], layers[newIdx]] = [layers[newIdx], layers[index]];
        this.collectLayers();
        console.log(`Слой ${index} перемещён ${direction}.`);
    }

    @logMethod
    editLayer(index: number, attr: string, value: string): void {
        if (index < 0 || index >= this.layers.length) {
            throw new Error('Слой не найден.');
        }
        const layer = this.layers[index];
        layer.attrs[attr] = value;
        if (!layer.element.$) layer.element.$ = {};
        layer.element.$[attr] = value;
        console.log(`Атрибут '${attr}' слоя ${index} установлен в '${value}'.`);
    }

    @logMethod
    async save(output?: string): Promise<void> {
        const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' } });
        const xmlString = builder.buildObject(this.xml);
        const out = output || this.filename;
        await fs.promises.writeFile(out, xmlString, 'utf-8');
        console.log(`Сохранено в ${out}`);
    }
}

// CLI с commander
program
    .name('svg_editor')
    .description('SVG Layer Editor (TypeScript)')
    .argument('<input>', 'Входной SVG файл')
    .action((input) => { (program as any).input = input; });

program
    .command('list')
    .description('Показать слои')
    .action(async () => {
        const editor = new SvgEditor((program as any).input);
        await editor.load();
        editor.listLayers();
    });

program
    .command('add-layer')
    .description('Добавить слой')
    .requiredOption('--id <id>', 'ID слоя')
    .option('--attr <key=value>', 'Дополнительные атрибуты', (val, prev) => {
        if (!prev) prev = {};
        const [key, value] = val.split('=');
        prev[key] = value;
        return prev;
    }, {})
    .action(async (options) => {
        const editor = new SvgEditor((program as any).input);
        await editor.load();
        editor.addLayer(options.id, options.attr);
        await editor.save((program as any).input);
    });

program
    .command('remove-layer')
    .description('Удалить слой')
    .requiredOption('--index <n>', 'Индекс слоя', parseInt)
    .action(async (options) => {
        const editor = new SvgEditor((program as any).input);
        await editor.load();
        editor.removeLayer(options.index);
        await editor.save((program as any).input);
    });

program
    .command('move-layer')
    .description('Переместить слой')
    .requiredOption('--index <n>', 'Индекс слоя', parseInt)
    .requiredOption('--direction <up|down>', 'Направление')
    .action(async (options) => {
        const editor = new SvgEditor((program as any).input);
        await editor.load();
        editor.moveLayer(options.index, options.direction);
        await editor.save((program as any).input);
    });

program
    .command('edit-layer')
    .description('Изменить атрибут слоя')
    .requiredOption('--index <n>', 'Индекс слоя', parseInt)
    .requiredOption('--attr <key>', 'Имя атрибута')
    .requiredOption('--value <val>', 'Новое значение')
    .action(async (options) => {
        const editor = new SvgEditor((program as any).input);
        await editor.load();
        editor.editLayer(options.index, options.attr, options.value);
        await editor.save((program as any).input);
    });

program
    .command('save')
    .description('Сохранить SVG')
    .option('--output <file>', 'Выходной файл')
    .action(async (options) => {
        const editor = new SvgEditor((program as any).input);
        await editor.load();
        await editor.save(options.output);
    });

program.parse(process.argv);
