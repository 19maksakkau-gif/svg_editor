<?php
// svg_editor.php
// Версия на PHP 8 с DOMDocument, атрибутами, генераторами

class SvgEditor {
    private string $filename;
    private DOMDocument $doc;
    private DOMElement $svgRoot;
    private array $layers = [];

    public function __construct(string $filename) {
        $this->filename = $filename;
        $this->doc = new DOMDocument();
        $this->doc->load($filename);
        $this->svgRoot = $this->doc->documentElement;
        $this->loadLayers();
    }

    private function loadLayers(): void {
        $this->layers = [];
        foreach ($this->svgRoot->childNodes as $node) {
            if ($node->nodeType === XML_ELEMENT_NODE) {
                $el = $node;
                if ($el->tagName === 'g' || $el->hasAttribute('data-layer')) {
                    $this->layers[] = $el;
                }
            }
        }
    }

    public function listLayers(): void {
        if (empty($this->layers)) {
            echo "Слои не найдены.\n";
            return;
        }
        foreach ($this->layers as $i => $el) {
            $id = $el->getAttribute('id') ?: $el->getAttribute('data-layer') ?: 'без id';
            $attrs = [];
            foreach ($el->attributes as $attr) {
                $attrs[] = $attr->name . '="' . $attr->value . '"';
            }
            echo sprintf("[%d] %s : %s\n", $i, $id, implode(' ', $attrs));
        }
    }

    public function addLayer(string $id, array $extraAttrs): void {
        $newGroup = $this->doc->createElement('g');
        if ($id) $newGroup->setAttribute('id', $id);
        foreach ($extraAttrs as $k => $v) {
            $newGroup->setAttribute($k, $v);
        }
        $this->svgRoot->appendChild($newGroup);
        $this->layers[] = $newGroup;
        echo "Слой '$id' добавлен.\n";
    }

    public function removeLayer(int $index): void {
        if (!isset($this->layers[$index])) {
            throw new Exception("Индекс вне диапазона");
        }
        $el = $this->layers[$index];
        $this->svgRoot->removeChild($el);
        array_splice($this->layers, $index, 1);
        echo "Слой $index удалён.\n";
    }

    public function moveLayer(int $index, string $direction): void {
        if (!isset($this->layers[$index])) {
            throw new Exception("Индекс вне диапазона");
        }
        $newIdx = $direction === 'up' ? $index - 1 : $index + 1;
        if ($newIdx < 0 || $newIdx >= count($this->layers)) {
            throw new Exception("Невозможно переместить");
        }
        $el1 = $this->layers[$index];
        $el2 = $this->layers[$newIdx];
        // Перемещаем в DOM
        if ($index < $newIdx) {
            $this->svgRoot->insertBefore($el2, $el1);
            $this->svgRoot->insertBefore($el1, $el2);
        } else {
            $this->svgRoot->insertBefore($el1, $el2);
            $this->svgRoot->insertBefore($el2, $el1);
        }
        // меняем местами в массиве
        $this->layers[$index] = $el2;
        $this->layers[$newIdx] = $el1;
        echo "Слой $index перемещён $direction.\n";
    }

    public function editLayer(int $index, string $attr, string $value): void {
        if (!isset($this->layers[$index])) {
            throw new Exception("Слой не найден");
        }
        $this->layers[$index]->setAttribute($attr, $value);
        echo "Атрибут '$attr' слоя $index установлен в '$value'.\n";
    }

    public function save(?string $output = null): void {
        $out = $output ?? $this->filename;
        $this->doc->save($out);
        echo "Сохранено в $out\n";
    }
}

// Парсинг аргументов
if ($argc < 3) {
    echo "Использование: php svg_editor.php <input.svg> <команда> [параметры]\n";
    exit(1);
}

$input = $argv[1];
$command = $argv[2];

$editor = new SvgEditor($input);

try {
    switch ($command) {
        case 'list':
            $editor->listLayers();
            break;
        case 'add-layer':
            $id = null;
            $extra = [];
            for ($i = 3; $i < $argc; $i++) {
                if ($argv[$i] === '--id' && isset($argv[$i+1])) {
                    $id = $argv[++$i];
                } elseif ($argv[$i] === '--attr' && isset($argv[$i+1])) {
                    $kv = explode('=', $argv[++$i], 2);
                    if (count($kv) === 2) $extra[$kv[0]] = $kv[1];
                }
            }
            $editor->addLayer($id, $extra);
            $editor->save(null);
            break;
        case 'remove-layer':
            $index = -1;
            for ($i = 3; $i < $argc; $i++) {
                if ($argv[$i] === '--index' && isset($argv[$i+1])) {
                    $index = (int)$argv[++$i];
                }
            }
            if ($index < 0) throw new Exception("Не указан --index");
            $editor->removeLayer($index);
            $editor->save(null);
            break;
        case 'move-layer':
            $index = -1; $dir = '';
            for ($i = 3; $i < $argc; $i++) {
                if ($argv[$i] === '--index' && isset($argv[$i+1])) {
                    $index = (int)$argv[++$i];
                } elseif ($argv[$i] === '--direction' && isset($argv[$i+1])) {
                    $dir = $argv[++$i];
                }
            }
            if ($index < 0 || empty($dir)) throw new Exception("Не указаны --index и --direction");
            $editor->moveLayer($index, $dir);
            $editor->save(null);
            break;
        case 'edit-layer':
            $index = -1; $attr = ''; $value = '';
            for ($i = 3; $i < $argc; $i++) {
                if ($argv[$i] === '--index' && isset($argv[$i+1])) {
                    $index = (int)$argv[++$i];
                } elseif ($argv[$i] === '--attr' && isset($argv[$i+1])) {
                    $attr = $argv[++$i];
                } elseif ($argv[$i] === '--value' && isset($argv[$i+1])) {
                    $value = $argv[++$i];
                }
            }
            if ($index < 0 || empty($attr) || empty($value)) {
                throw new Exception("Не указаны --index, --attr, --value");
            }
            $editor->editLayer($index, $attr, $value);
            $editor->save(null);
            break;
        case 'save':
            $output = null;
            for ($i = 3; $i < $argc; $i++) {
                if ($argv[$i] === '--output' && isset($argv[$i+1])) {
                    $output = $argv[++$i];
                }
            }
            $editor->save($output);
            break;
        default:
            echo "Неизвестная команда: $command\n";
    }
} catch (Exception $e) {
    echo "Ошибка: " . $e->getMessage() . "\n";
    exit(1);
}
