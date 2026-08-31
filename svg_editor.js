// svg_editor.js
// Версия на JavaScript с использованием xml2js, commander, fs

const fs = require('fs');
const { Command } = require('commander');
const xml2js = require('xml2js');

class SvgEditor {
    constructor(filepath) {
        this.filepath = filepath;
        this.xml = null;
        this.svg = null;
        this.layers = [];
    }

    async load() {
        const data = await fs.promises.readFile(this.filepath, 'utf-8');
        const parser = new xml2js.Parser({ explicitArray: false });
        this.xml = await parser.parseStringPromise(data);
        this.svg = this.xml.svg;
        this._collectLayers();
    }

    _collectLayers() {
        this.layers = [];
        if (!this.svg) return;
        const children = this.svg.g || [];
        // если только один слой, xml2js может сделать его объектом, а не массивом
        const items = Array.isArray(children) ? children : [children];
        items.forEach((elem, idx) => {
            // группа может быть без явного тега, но мы ищем по $ (атрибуты)
            if (elem.$ && elem.$.id) {
                this.layers.push({ index: idx, element: elem, id: elem.$.id, attrs: elem.$ });
            } else if (elem.$ && elem.$['data-layer']) {
                this.layers.push({ index: idx, element: elem, id: elem.$['data-layer'], attrs: elem.$ });
            } else {
                // считаем любые элементы верхнего уровня слоями, если есть атрибут data-layer
                this.layers.push({ index: idx, element: elem, id: elem.$?.['data-layer'] || null, attrs: elem.$ || {} });
            }
        });
    }

    listLayers() {
        if (this.layers.length === 0) {
            console.log('Слои не найдены.');
            return;
        }
        this.layers.forEach(l => {
            const attrsStr = Object.entries(l.attrs).map(([k,v]) => `${k}="${v}"`).join(' ');
            console.log(`[${l.index}] ${l.id || 'без id'} : ${attrsStr}`);
        });
    }

    addLayer(id, extraAttrs = {}) {
        const newGroup = { $: { id, ...extraAttrs } };
        if (!this.svg.g) {
            this.svg.g = [];
        }
        // если это не массив, преобразуем
        if (!Array.isArray(this.svg.g)) {
            this.svg.g = [this.svg.g];
        }
        this.svg.g.push(newGroup);
        this._collectLayers(); // перезагружаем список
        console.log(`Слой '${id}' добавлен.`);
    }

    removeLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            throw new Error('Индекс вне диапазона.');
        }
        const layers = this.svg.g;
        if (Array.isArray(layers)) {
            layers.splice(index, 1);
        } else if (layers) {
            // если только один элемент, удаляем весь массив
            this.svg.g = null;
        }
        this._collectLayers();
        console.log(`Слой ${index} удалён.`);
    }

    moveLayer(index, direction) {
        if (index < 0 || index >= this.layers.length) {
            throw new Error('Индекс вне диапазона.');
        }
        const layers = this.svg.g;
        if (!Array.isArray(layers)) {
            throw new Error('Невозможно переместить: не массив слоёв.');
        }
        let newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= layers.length) {
            throw new Error('Невозможно переместить в указанном направлении.');
        }
        // меняем местами
        [layers[index], layers[newIndex]] = [layers[newIndex], layers[index]];
        this._collectLayers();
        console.log(`Слой ${index} перемещён ${direction === 'up' ? 'вверх' : 'вниз'}.`);
    }

    editLayer(index, attr, value) {
        if (index < 0 || index >= this.layers.length) {
            throw new Error('Слой не найден.');
        }
        const layer = this.layers[index];
        if (!layer.attrs) layer.attrs = {};
        layer.attrs[attr] = value;
        // обновляем элемент
        if (layer.element.$) {
            layer.element.$[attr] = value;
        } else {
            layer.element.$ = { [attr]: value };
        }
        console.log(`Атрибут '${attr}' слоя ${index} установлен в '${value}'.`);
    }

    async save(outputFile) {
        const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' } });
        const xmlString = builder.buildObject(this.xml);
        const out = outputFile || this.filepath;
        await fs.promises.writeFile(out, xmlString, 'utf-8');
        console.log(`Сохранено в ${out}`);
    }
}

// CLI с commander
const program = new Command();
program
    .name('svg_editor')
    .description('SVG Layer Editor (JavaScript)')
    .argument('<input>', 'Входной SVG файл')
    .action((input) => {
        // сохранение input для использования в подкомандах
        program.input = input;
    });

program
    .command('list')
    .description('Показать слои')
    .action(async () => {
        const editor = new SvgEditor(program.input);
        await editor.load();
        editor.listLayers();
    });

program
    .command('add-layer')
    .description('Добавить слой')
    .requiredOption('--id <id>', 'ID слоя')
    .option('--attr <key=value>', 'Дополнительные атрибуты', (val, prev) => {
        // собираем атрибуты в объект
        if (!prev) prev = {};
        const [key, value] = val.split('=');
        prev[key] = value;
        return prev;
    }, {})
    .action(async (options) => {
        const editor = new SvgEditor(program.input);
        await editor.load();
        editor.addLayer(options.id, options.attr);
        await editor.save(program.input); // сохраняем изменения
    });

program
    .command('remove-layer')
    .description('Удалить слой')
    .requiredOption('--index <n>', 'Индекс слоя', parseInt)
    .action(async (options) => {
        const editor = new SvgEditor(program.input);
        await editor.load();
        editor.removeLayer(options.index);
        await editor.save(program.input);
    });

program
    .command('move-layer')
    .description('Переместить слой')
    .requiredOption('--index <n>', 'Индекс слоя', parseInt)
    .requiredOption('--direction <up|down>', 'Направление')
    .action(async (options) => {
        const editor = new SvgEditor(program.input);
        await editor.load();
        editor.moveLayer(options.index, options.direction);
        await editor.save(program.input);
    });

program
    .command('edit-layer')
    .description('Изменить атрибут слоя')
    .requiredOption('--index <n>', 'Индекс слоя', parseInt)
    .requiredOption('--attr <key>', 'Имя атрибута')
    .requiredOption('--value <val>', 'Новое значение')
    .action(async (options) => {
        const editor = new SvgEditor(program.input);
        await editor.load();
        editor.editLayer(options.index, options.attr, options.value);
        await editor.save(program.input);
    });

program
    .command('save')
    .description('Сохранить SVG')
    .option('--output <file>', 'Выходной файл')
    .action(async (options) => {
        // если команда save вызвана без изменений, просто копируем
        const editor = new SvgEditor(program.input);
        await editor.load();
        await editor.save(options.output);
    });

program.parse(process.argv);
