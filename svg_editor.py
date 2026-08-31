# svg_editor.py
# Версия на Python с использованием xml.etree.ElementTree и argparse

import argparse
import sys
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional

class SvgLayer:
    """Представление слоя (группы)."""
    def __init__(self, index: int, element: ET.Element):
        self.index = index
        self.element = element

    @property
    def id(self) -> Optional[str]:
        return self.element.get('id') or self.element.get('data-layer')

    @property
    def attributes(self) -> Dict[str, str]:
        return dict(self.element.attrib)

    def set_attr(self, key: str, value: str) -> None:
        self.element.set(key, value)

    def __str__(self) -> str:
        attrs = ' '.join(f'{k}="{v}"' for k, v in self.attributes.items())
        return f"[{self.index}] {self.id or 'без id'} : {attrs}"

class SvgEditor:
    def __init__(self, filename: str):
        self.filename = filename
        self.tree = ET.parse(filename)
        self.root = self.tree.getroot()
        # Пространство имён SVG (если есть)
        self.ns = {'svg': 'http://www.w3.org/2000/svg'}
        # Ищем все группы верхнего уровня
        self.layers: List[SvgLayer] = []
        self._load_layers()

    def _load_layers(self) -> None:
        """Загружает все дочерние элементы <g> корня."""
        # Игнорируем группы внутри других групп (вложенные слои)
        # Предполагаем, что слои — это непосредственные дети <svg>
        for idx, child in enumerate(self.root):
            if child.tag == 'g' or child.tag.endswith('g'):
                self.layers.append(SvgLayer(idx, child))
            # Также можно считать слоями элементы с атрибутом data-layer
            elif child.get('data-layer') is not None:
                self.layers.append(SvgLayer(idx, child))

    def list_layers(self) -> None:
        if not self.layers:
            print("Слои не найдены.")
            return
        for layer in self.layers:
            print(layer)

    def add_layer(self, layer_id: str, attrs: Dict[str, str]) -> None:
        """Добавляет новый слой (группу) в конец."""
        new_group = ET.Element('g')
        if layer_id:
            new_group.set('id', layer_id)
        for k, v in attrs.items():
            new_group.set(k, v)
        self.root.append(new_group)
        # Обновляем список
        self.layers.append(SvgLayer(len(self.layers), new_group))
        print(f"Слой '{layer_id}' добавлен.")

    def remove_layer(self, index: Optional[int] = None, layer_id: Optional[str] = None) -> None:
        """Удаляет слой по индексу или id."""
        if index is not None and 0 <= index < len(self.layers):
            layer = self.layers[index]
            self.root.remove(layer.element)
            del self.layers[index]
            print(f"Слой {index} удалён.")
            return
        if layer_id is not None:
            for idx, layer in enumerate(self.layers):
                if layer.id == layer_id:
                    self.root.remove(layer.element)
                    del self.layers[idx]
                    print(f"Слой с id '{layer_id}' удалён.")
                    return
        raise ValueError("Слой не найден.")

    def move_layer(self, index: int, direction: str) -> None:
        """Перемещает слой вверх или вниз."""
        if not (0 <= index < len(self.layers)):
            raise ValueError("Индекс вне диапазона.")
        if direction == 'up' and index > 0:
            self._swap_layers(index, index - 1)
        elif direction == 'down' and index < len(self.layers) - 1:
            self._swap_layers(index, index + 1)
        else:
            raise ValueError("Невозможно переместить в указанном направлении.")

    def _swap_layers(self, i: int, j: int) -> None:
        """Меняет местами два слоя в дереве и списке."""
        # В дереве меняем местами элементы
        children = list(self.root)
        self.root.remove(self.layers[i].element)
        self.root.remove(self.layers[j].element)
        # Вставляем в правильном порядке
        if i < j:
            self.root.insert(i, self.layers[j].element)
            self.root.insert(j, self.layers[i].element)
        else:
            self.root.insert(j, self.layers[i].element)
            self.root.insert(i, self.layers[j].element)
        # Обновляем индексы в списке
        self.layers[i], self.layers[j] = self.layers[j], self.layers[i]
        self.layers[i].index, self.layers[j].index = i, j
        print(f"Слой {i} и {j} поменялись местами.")

    def edit_layer(self, index: int, attr: str, value: str) -> None:
        """Изменяет атрибут слоя."""
        if not (0 <= index < len(self.layers)):
            raise ValueError("Слой не найден.")
        self.layers[index].set_attr(attr, value)
        print(f"Атрибут '{attr}' слоя {index} установлен в '{value}'.")

    def save(self, output_filename: Optional[str] = None) -> None:
        """Сохраняет дерево в файл."""
        out = output_filename or self.filename
        # Добавляем объявление XML
        self.tree.write(out, encoding='utf-8', xml_declaration=True)
        print(f"Сохранено в {out}")

def main():
    parser = argparse.ArgumentParser(description='SVG Layer Editor (Python)')
    parser.add_argument('input', help='Входной SVG файл')
    subparsers = parser.add_subparsers(dest='command', required=True, help='Команда')

    # list
    parser_list = subparsers.add_parser('list', help='Показать слои')

    # add-layer
    parser_add = subparsers.add_parser('add-layer', help='Добавить слой')
    parser_add.add_argument('--id', required=True, help='ID слоя')
    parser_add.add_argument('--attr', action='append', help='Дополнительные атрибуты (key=value)')

    # remove-layer
    parser_remove = subparsers.add_parser('remove-layer', help='Удалить слой')
    group = parser_remove.add_mutually_exclusive_group(required=True)
    group.add_argument('--index', type=int, help='Индекс слоя')
    group.add_argument('--id', help='ID слоя')

    # move-layer
    parser_move = subparsers.add_parser('move-layer', help='Переместить слой')
    parser_move.add_argument('--index', type=int, required=True, help='Индекс слоя')
    parser_move.add_argument('--direction', choices=['up', 'down'], required=True, help='Направление')

    # edit-layer
    parser_edit = subparsers.add_parser('edit-layer', help='Изменить атрибут слоя')
    parser_edit.add_argument('--index', type=int, required=True, help='Индекс слоя')
    parser_edit.add_argument('--attr', required=True, help='Имя атрибута')
    parser_edit.add_argument('--value', required=True, help='Новое значение')

    # save
    parser_save = subparsers.add_parser('save', help='Сохранить SVG')
    parser_save.add_argument('--output', help='Выходной файл (по умолчанию перезаписывает входной)')

    args = parser.parse_args()

    try:
        editor = SvgEditor(args.input)
    except Exception as e:
        print(f"Ошибка при загрузке SVG: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        if args.command == 'list':
            editor.list_layers()
        elif args.command == 'add-layer':
            attrs = {}
            if args.attr:
                for a in args.attr:
                    if '=' not in a:
                        print(f"Предупреждение: пропущен атрибут '{a}' (нет '=')")
                        continue
                    k, v = a.split('=', 1)
                    attrs[k] = v
            editor.add_layer(args.id, attrs)
        elif args.command == 'remove-layer':
            editor.remove_layer(index=args.index, layer_id=args.id)
        elif args.command == 'move-layer':
            editor.move_layer(args.index, args.direction)
        elif args.command == 'edit-layer':
            editor.edit_layer(args.index, args.attr, args.value)
        elif args.command == 'save':
            editor.save(args.output)
        else:
            print("Неизвестная команда")
    except Exception as e:
        print(f"Ошибка: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
