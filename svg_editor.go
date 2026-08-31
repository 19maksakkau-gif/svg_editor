// svg_editor.go
// Версия на Go с использованием encoding/xml, горутинами для параллельного парсинга (опционально)

package main

import (
	"encoding/xml"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"strconv"
	"strings"
)

// SVG структуры для парсинга
type SVG struct {
	XMLName xml.Name `xml:"svg"`
	Groups  []Group  `xml:"g"`
	// другие элементы игнорируем
}

type Group struct {
	XMLName xml.Name `xml:"g"`
	Attrs   []xml.Attr `xml:",any,attr"`
	// содержимое игнорируем для простоты
}

type Layer struct {
	Index   int
	Element Group
	ID      string
}

type Editor struct {
	filename string
	svg      SVG
	layers   []Layer
}

func NewEditor(filename string) (*Editor, error) {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	var svg SVG
	err = xml.Unmarshal(data, &svg)
	if err != nil {
		return nil, err
	}
	e := &Editor{filename: filename, svg: svg}
	e.collectLayers()
	return e, nil
}

func (e *Editor) collectLayers() {
	e.layers = []Layer{}
	for i, g := range e.svg.Groups {
		id := ""
		for _, attr := range g.Attrs {
			if attr.Name.Local == "id" {
				id = attr.Value
				break
			}
			if attr.Name.Local == "data-layer" {
				id = attr.Value
			}
		}
		e.layers = append(e.layers, Layer{Index: i, Element: g, ID: id})
	}
}

func (e *Editor) ListLayers() {
	if len(e.layers) == 0 {
		fmt.Println("Слои не найдены.")
		return
	}
	for _, l := range e.layers {
		attrs := ""
		for _, a := range l.Element.Attrs {
			attrs += fmt.Sprintf(`%s="%s" `, a.Name.Local, a.Value)
		}
		fmt.Printf("[%d] %s : %s\n", l.Index, l.ID, attrs)
	}
}

func (e *Editor) AddLayer(id string, extraAttrs map[string]string) {
	newGroup := Group{}
	attrs := []xml.Attr{}
	if id != "" {
		attrs = append(attrs, xml.Attr{Name: xml.Name{Local: "id"}, Value: id})
	}
	for k, v := range extraAttrs {
		attrs = append(attrs, xml.Attr{Name: xml.Name{Local: k}, Value: v})
	}
	newGroup.Attrs = attrs
	e.svg.Groups = append(e.svg.Groups, newGroup)
	e.collectLayers()
	fmt.Printf("Слой '%s' добавлен.\n", id)
}

func (e *Editor) RemoveLayer(index int) {
	if index < 0 || index >= len(e.svg.Groups) {
		panic("Индекс вне диапазона")
	}
	e.svg.Groups = append(e.svg.Groups[:index], e.svg.Groups[index+1:]...)
	e.collectLayers()
	fmt.Printf("Слой %d удалён.\n", index)
}

func (e *Editor) MoveLayer(index int, direction string) {
	if index < 0 || index >= len(e.svg.Groups) {
		panic("Индекс вне диапазона")
	}
	newIdx := index - 1
	if direction == "down" {
		newIdx = index + 1
	}
	if newIdx < 0 || newIdx >= len(e.svg.Groups) {
		panic("Невозможно переместить в указанном направлении")
	}
	e.svg.Groups[index], e.svg.Groups[newIdx] = e.svg.Groups[newIdx], e.svg.Groups[index]
	e.collectLayers()
	fmt.Printf("Слой %d перемещён %s.\n", index, direction)
}

func (e *Editor) EditLayer(index int, attr, value string) {
	if index < 0 || index >= len(e.svg.Groups) {
		panic("Слой не найден")
	}
	// ищем атрибут
	found := false
	for i := range e.svg.Groups[index].Attrs {
		if e.svg.Groups[index].Attrs[i].Name.Local == attr {
			e.svg.Groups[index].Attrs[i].Value = value
			found = true
			break
		}
	}
	if !found {
		e.svg.Groups[index].Attrs = append(e.svg.Groups[index].Attrs, xml.Attr{Name: xml.Name{Local: attr}, Value: value})
	}
	e.collectLayers()
	fmt.Printf("Атрибут '%s' слоя %d установлен в '%s'.\n", attr, index, value)
}

func (e *Editor) Save(output string) error {
	out := output
	if out == "" {
		out = e.filename
	}
	data, err := xml.MarshalIndent(e.svg, "", "  ")
	if err != nil {
		return err
	}
	// добавляем заголовок XML
	data = []byte(xml.Header + string(data))
	return ioutil.WriteFile(out, data, 0644)
}

func main() {
	// Простой парсинг флагов: используем подкоманды через os.Args
	if len(os.Args) < 3 {
		fmt.Println("Использование: go run svg_editor.go <input.svg> <команда> [параметры]")
		os.Exit(1)
	}
	input := os.Args[1]
	command := os.Args[2]

	editor, err := NewEditor(input)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Ошибка загрузки: %v\n", err)
		os.Exit(1)
	}

	switch command {
	case "list":
		editor.ListLayers()
	case "add-layer":
		// args: --id <id> [--attr key=value ...]
		id := ""
		attrs := map[string]string{}
		for i := 3; i < len(os.Args); i++ {
			if os.Args[i] == "--id" && i+1 < len(os.Args) {
				id = os.Args[i+1]
				i++
			} else if os.Args[i] == "--attr" && i+1 < len(os.Args) {
				kv := strings.SplitN(os.Args[i+1], "=", 2)
				if len(kv) == 2 {
					attrs[kv[0]] = kv[1]
				}
				i++
			}
		}
		editor.AddLayer(id, attrs)
		editor.Save("")
	case "remove-layer":
		// --index N
		index := -1
		for i := 3; i < len(os.Args); i++ {
			if os.Args[i] == "--index" && i+1 < len(os.Args) {
				idx, err := strconv.Atoi(os.Args[i+1])
				if err == nil {
					index = idx
				}
				i++
			}
		}
		if index < 0 {
			fmt.Println("Не указан --index")
			os.Exit(1)
		}
		editor.RemoveLayer(index)
		editor.Save("")
	case "move-layer":
		index := -1
		direction := ""
		for i := 3; i < len(os.Args); i++ {
			if os.Args[i] == "--index" && i+1 < len(os.Args) {
				idx, err := strconv.Atoi(os.Args[i+1])
				if err == nil {
					index = idx
				}
				i++
			} else if os.Args[i] == "--direction" && i+1 < len(os.Args) {
				direction = os.Args[i+1]
				i++
			}
		}
		if index < 0 || direction == "" {
			fmt.Println("Не указаны --index или --direction")
			os.Exit(1)
		}
		editor.MoveLayer(index, direction)
		editor.Save("")
	case "edit-layer":
		index := -1
		attr := ""
		value := ""
		for i := 3; i < len(os.Args); i++ {
			if os.Args[i] == "--index" && i+1 < len(os.Args) {
				idx, err := strconv.Atoi(os.Args[i+1])
				if err == nil {
					index = idx
				}
				i++
			} else if os.Args[i] == "--attr" && i+1 < len(os.Args) {
				attr = os.Args[i+1]
				i++
			} else if os.Args[i] == "--value" && i+1 < len(os.Args) {
				value = os.Args[i+1]
				i++
			}
		}
		if index < 0 || attr == "" || value == "" {
			fmt.Println("Не указаны --index, --attr, --value")
			os.Exit(1)
		}
		editor.EditLayer(index, attr, value)
		editor.Save("")
	case "save":
		output := ""
		for i := 3; i < len(os.Args); i++ {
			if os.Args[i] == "--output" && i+1 < len(os.Args) {
				output = os.Args[i+1]
				i++
			}
		}
		editor.Save(output)
	default:
		fmt.Printf("Неизвестная команда: %s\n", command)
		os.Exit(1)
	}
}
