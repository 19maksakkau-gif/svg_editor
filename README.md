Репозиторий SVG Layer Editor
Описание
SVG Layer Editor – это набор консольных утилит на 8 языках программирования для редактирования слоёв в SVG-файлах. Слои реализованы как элементы <g> (группы) с атрибутом id или data-layer. Программа позволяет просматривать, добавлять, удалять, перемещать и изменять атрибуты слоёв, а также сохранять результат.

Проект создан как тестовый репозиторий для демонстрации решения одной задачи на разных языках с использованием идиоматичных подходов и продвинутых возможностей.

Возможности
Просмотр списка слоёв – вывод имён и атрибутов всех групп верхнего уровня.

Добавление слоя – создание новой группы с указанным id (можно также задать дополнительные атрибуты).

Удаление слоя – по индексу или по id.

Перемещение слоя – изменение порядка слоёв (вверх/вниз или на указанную позицию).

Редактирование атрибутов – изменение любого атрибута слоя (например, fill, stroke, transform).

Экспорт – сохранение изменённого SVG в новый файл (или перезапись исходного).

Работа с фигурами – в некоторых реализациях добавлена возможность добавлять примитивы (прямоугольник, круг) в выбранный слой.

Импорт CSS-стилей – поддержка инлайн-стилей (опционально).

Все операции выполняются через аргументы командной строки, что позволяет легко интегрировать редактор в скрипты и CI/CD.

Структура репозитория
text
svg-layer-editor/
├── README.md
├── svg_editor.py          (Python)
├── svg_editor.js          (JavaScript / Node.js)
├── svg_editor.go          (Go)
├── SvgEditor.java         (Java)
├── SvgEditor.cs           (C#)
├── svg_editor.php         (PHP)
├── svg_editor.rb          (Ruby)
└── svg_editor.ts          (TypeScript)
Установка и запуск
Каждый файл является самостоятельной программой. Для запуска необходима соответствующая среда выполнения.

Язык	Установка	Запуск
Python	Python 3.8+	python svg_editor.py [команды]
JavaScript	Node.js 14+	node svg_editor.js [команды]
Go	Go 1.18+	go run svg_editor.go [команды]
Java	JDK 11+	javac SvgEditor.java && java SvgEditor [команды]
C#	.NET SDK 6.0+	dotnet run или csc
PHP	PHP 7.4+	php svg_editor.php [команды]
Ruby	Ruby 2.7+	ruby svg_editor.rb [команды]
TypeScript	Node.js + npm install -g ts-node typescript	ts-node svg_editor.ts [команды]
Использование
Все программы поддерживают единообразный интерфейс командной строки:

text
svg_editor <input.svg> <команда> [параметры]
Команды
Команда	Описание
list	Вывести список слоёв (индекс, id, другие атрибуты).
add-layer --id <id>	Добавить новый слой с указанным id (можно добавить --attr key=value).
remove-layer --index <n>	Удалить слой по индексу (или --id <id>).
move-layer --index <n> --direction <up/down>	Переместить слой вверх/вниз.
edit-layer --index <n> --attr <key> --value <val>	Изменить атрибут слоя.
save --output <file>	Сохранить результат в файл (если не указано, перезаписывает исходный).
help	Показать справку.
Примеры
bash
# Показать все слои
python svg_editor.py drawing.svg list

# Добавить слой с id "background" и атрибутом fill="#eee"
python svg_editor.py drawing.svg add-layer --id background --attr fill="#eee"

# Удалить слой с индексом 2
python svg_editor.py drawing.svg remove-layer --index 2

# Переместить слой 0 вниз
python svg_editor.py drawing.svg move-layer --index 0 --direction down

# Изменить цвет заливки слоя с id "shapes"
python svg_editor.py drawing.svg edit-layer --id shapes --attr fill --value blue

# Сохранить в новый файл
python svg_editor.py drawing.svg save --output new_drawing.svg
Особенности реализаций
Каждая версия использует идиоматичные для языка подходы:

Python – xml.etree.ElementTree, dataclasses, argparse.

JavaScript – xml2js (или cheerio), async/await, commander.

Go – encoding/xml, структуры, горутины для параллельной обработки (опционально).

Java – javax.xml.parsers, org.w3c.dom, Stream API.

C# – System.Xml, LINQ, record types.

PHP – DOMDocument, атрибуты (PHP 8).

Ruby – REXML, метапрограммирование.

TypeScript – xml2js, строгая типизация, декораторы (экспериментальные).

Во всех реализациях предусмотрена обработка ошибок и валидация ввода.

Лицензия
MIT

