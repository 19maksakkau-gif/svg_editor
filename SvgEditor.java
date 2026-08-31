// SvgEditor.java
// Версия на Java с javax.xml.parsers, org.w3c.dom, Stream API

import javax.xml.parsers.*;
import javax.xml.transform.*;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.w3c.dom.*;
import java.io.*;
import java.util.*;
import java.util.stream.IntStream;

public class SvgEditor {
    private final String filename;
    private Document doc;
    private Element svgRoot;
    private List<Element> layers; // все группы верхнего уровня

    public SvgEditor(String filename) throws Exception {
        this.filename = filename;
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();
        doc = builder.parse(new File(filename));
        svgRoot = doc.getDocumentElement();
        loadLayers();
    }

    private void loadLayers() {
        layers = new ArrayList<>();
        NodeList children = svgRoot.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node node = children.item(i);
            if (node.getNodeType() == Node.ELEMENT_NODE) {
                Element elem = (Element) node;
                // считаем группы или элементы с атрибутом data-layer
                if ("g".equals(elem.getTagName()) || elem.hasAttribute("data-layer")) {
                    layers.add(elem);
                }
            }
        }
    }

    public void listLayers() {
        if (layers.isEmpty()) {
            System.out.println("Слои не найдены.");
            return;
        }
        IntStream.range(0, layers.size()).forEach(i -> {
            Element e = layers.get(i);
            String id = e.getAttribute("id");
            if (id.isEmpty()) id = e.getAttribute("data-layer");
            System.out.printf("[%d] %s : %s%n", i, id.isEmpty() ? "без id" : id, attrsToString(e));
        });
    }

    private String attrsToString(Element e) {
        NamedNodeMap attrs = e.getAttributes();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < attrs.getLength(); i++) {
            Attr a = (Attr) attrs.item(i);
            sb.append(a.getName()).append("=\"").append(a.getValue()).append("\" ");
        }
        return sb.toString();
    }

    public void addLayer(String id, Map<String, String> extraAttrs) {
        Element newGroup = doc.createElement("g");
        if (id != null && !id.isEmpty()) newGroup.setAttribute("id", id);
        extraAttrs.forEach(newGroup::setAttribute);
        svgRoot.appendChild(newGroup);
        layers.add(newGroup);
        System.out.println("Слой '" + id + "' добавлен.");
    }

    public void removeLayer(int index) {
        if (index < 0 || index >= layers.size()) throw new IndexOutOfBoundsException("Индекс вне диапазона");
        Element layer = layers.remove(index);
        svgRoot.removeChild(layer);
        System.out.println("Слой " + index + " удалён.");
    }

    public void moveLayer(int index, String direction) {
        if (index < 0 || index >= layers.size()) throw new IndexOutOfBoundsException("Индекс вне диапазона");
        int newIdx = direction.equals("up") ? index - 1 : index + 1;
        if (newIdx < 0 || newIdx >= layers.size()) throw new IllegalArgumentException("Невозможно переместить");
        // меняем местами в DOM
        Element el1 = layers.get(index);
        Element el2 = layers.get(newIdx);
        svgRoot.insertBefore(el1, el2);
        svgRoot.insertBefore(el2, el1); // не работает корректно, лучше использовать replaceChild? 
        // Проще: удалить и вставить заново.
        // Для простоты переставим в списке и пересоздадим дерево? Нет, проще сделать swap.
        // Перемещаем элементы через removeChild и insertBefore
        svgRoot.removeChild(el1);
        svgRoot.removeChild(el2);
        // Вставляем в правильном порядке
        if (index < newIdx) {
            svgRoot.insertBefore(el2, el1); // el1 уже удалён, но ещё в памяти
            svgRoot.insertBefore(el1, el2);
        } else {
            svgRoot.insertBefore(el1, el2);
            svgRoot.insertBefore(el2, el1);
        }
        // обновляем список
        Collections.swap(layers, index, newIdx);
        System.out.println("Слой " + index + " перемещён " + direction);
    }

    public void editLayer(int index, String attr, String value) {
        if (index < 0 || index >= layers.size()) throw new IndexOutOfBoundsException("Слой не найден");
        Element layer = layers.get(index);
        layer.setAttribute(attr, value);
        System.out.println("Атрибут '" + attr + "' слоя " + index + " установлен в '" + value + "'.");
    }

    public void save(String output) throws TransformerException {
        String out = (output == null || output.isEmpty()) ? filename : output;
        TransformerFactory factory = TransformerFactory.newInstance();
        Transformer transformer = factory.newTransformer();
        transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        transformer.setOutputProperty(OutputKeys.INDENT, "yes");
        transformer.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "2");
        DOMSource source = new DOMSource(doc);
        StreamResult result = new StreamResult(new File(out));
        transformer.transform(source, result);
        System.out.println("Сохранено в " + out);
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Использование: java SvgEditor <input.svg> <команда> [параметры]");
            System.exit(1);
        }
        String input = args[0];
        String command = args[1];
        SvgEditor editor = new SvgEditor(input);

        try {
            switch (command) {
                case "list":
                    editor.listLayers();
                    break;
                case "add-layer": {
                    String id = null;
                    Map<String, String> extra = new HashMap<>();
                    for (int i = 2; i < args.length; i++) {
                        if (args[i].equals("--id") && i+1 < args.length) {
                            id = args[++i];
                        } else if (args[i].equals("--attr") && i+1 < args.length) {
                            String kv = args[++i];
                            String[] parts = kv.split("=", 2);
                            if (parts.length == 2) extra.put(parts[0], parts[1]);
                        }
                    }
                    editor.addLayer(id, extra);
                    editor.save(null);
                    break;
                }
                case "remove-layer": {
                    int index = -1;
                    for (int i = 2; i < args.length; i++) {
                        if (args[i].equals("--index") && i+1 < args.length) {
                            index = Integer.parseInt(args[++i]);
                        }
                    }
                    if (index < 0) throw new IllegalArgumentException("Не указан --index");
                    editor.removeLayer(index);
                    editor.save(null);
                    break;
                }
                case "move-layer": {
                    int index = -1;
                    String dir = "";
                    for (int i = 2; i < args.length; i++) {
                        if (args[i].equals("--index") && i+1 < args.length) {
                            index = Integer.parseInt(args[++i]);
                        } else if (args[i].equals("--direction") && i+1 < args.length) {
                            dir = args[++i];
                        }
                    }
                    if (index < 0 || dir.isEmpty()) throw new IllegalArgumentException("Не указаны --index и --direction");
                    editor.moveLayer(index, dir);
                    editor.save(null);
                    break;
                }
                case "edit-layer": {
                    int index = -1;
                    String attr = "", value = "";
                    for (int i = 2; i < args.length; i++) {
                        if (args[i].equals("--index") && i+1 < args.length) {
                            index = Integer.parseInt(args[++i]);
                        } else if (args[i].equals("--attr") && i+1 < args.length) {
                            attr = args[++i];
                        } else if (args[i].equals("--value") && i+1 < args.length) {
                            value = args[++i];
                        }
                    }
                    if (index < 0 || attr.isEmpty() || value.isEmpty())
                        throw new IllegalArgumentException("Не указаны --index, --attr, --value");
                    editor.editLayer(index, attr, value);
                    editor.save(null);
                    break;
                }
                case "save": {
                    String output = null;
                    for (int i = 2; i < args.length; i++) {
                        if (args[i].equals("--output") && i+1 < args.length) {
                            output = args[++i];
                        }
                    }
                    editor.save(output);
                    break;
                }
                default:
                    System.err.println("Неизвестная команда: " + command);
            }
        } catch (Exception e) {
            System.err.println("Ошибка: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
