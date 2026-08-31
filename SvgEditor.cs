// SvgEditor.cs
// Версия на C# с использованием System.Xml, LINQ, record types

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Xml;

public record LayerInfo(int Index, string Id, Dictionary<string, string> Attributes);

public class SvgEditor
{
    private readonly string _filename;
    private XmlDocument _doc;
    private XmlElement _svgRoot;
    private List<XmlElement> _layers = new();

    public SvgEditor(string filename)
    {
        _filename = filename;
        _doc = new XmlDocument();
        _doc.Load(filename);
        _svgRoot = _doc.DocumentElement;
        LoadLayers();
    }

    private void LoadLayers()
    {
        _layers = _svgRoot.ChildNodes
            .OfType<XmlElement>()
            .Where(e => e.Name == "g" || e.HasAttribute("data-layer"))
            .ToList();
    }

    public void ListLayers()
    {
        if (!_layers.Any())
        {
            Console.WriteLine("Слои не найдены.");
            return;
        }
        for (int i = 0; i < _layers.Count; i++)
        {
            var el = _layers[i];
            string id = el.GetAttribute("id");
            if (string.IsNullOrEmpty(id)) id = el.GetAttribute("data-layer");
            string attrs = string.Join(" ", el.Attributes.Cast<XmlAttribute>().Select(a => $"{a.Name}=\"{a.Value}\""));
            Console.WriteLine($"[{i}] {(string.IsNullOrEmpty(id) ? "без id" : id)} : {attrs}");
        }
    }

    public void AddLayer(string id, Dictionary<string, string> extraAttrs)
    {
        var newGroup = _doc.CreateElement("g");
        if (!string.IsNullOrEmpty(id)) newGroup.SetAttribute("id", id);
        foreach (var kv in extraAttrs)
            newGroup.SetAttribute(kv.Key, kv.Value);
        _svgRoot.AppendChild(newGroup);
        _layers.Add(newGroup);
        Console.WriteLine($"Слой '{id}' добавлен.");
    }

    public void RemoveLayer(int index)
    {
        if (index < 0 || index >= _layers.Count) throw new IndexOutOfRangeException("Индекс вне диапазона");
        var el = _layers[index];
        _svgRoot.RemoveChild(el);
        _layers.RemoveAt(index);
        Console.WriteLine($"Слой {index} удалён.");
    }

    public void MoveLayer(int index, string direction)
    {
        if (index < 0 || index >= _layers.Count) throw new IndexOutOfRangeException("Индекс вне диапазона");
        int newIdx = direction == "up" ? index - 1 : index + 1;
        if (newIdx < 0 || newIdx >= _layers.Count) throw new InvalidOperationException("Невозможно переместить");
        var el1 = _layers[index];
        var el2 = _layers[newIdx];
        _svgRoot.RemoveChild(el1);
        _svgRoot.RemoveChild(el2);
        if (index < newIdx)
        {
            _svgRoot.InsertBefore(el2, el1);
            _svgRoot.InsertBefore(el1, el2);
        }
        else
        {
            _svgRoot.InsertBefore(el1, el2);
            _svgRoot.InsertBefore(el2, el1);
        }
        (_layers[index], _layers[newIdx]) = (_layers[newIdx], _layers[index]);
        Console.WriteLine($"Слой {index} перемещён {direction}.");
    }

    public void EditLayer(int index, string attr, string value)
    {
        if (index < 0 || index >= _layers.Count) throw new IndexOutOfRangeException("Слой не найден");
        var el = _layers[index];
        el.SetAttribute(attr, value);
        Console.WriteLine($"Атрибут '{attr}' слоя {index} установлен в '{value}'.");
    }

    public void Save(string output)
    {
        string outFile = string.IsNullOrEmpty(output) ? _filename : output;
        _doc.Save(outFile);
        Console.WriteLine($"Сохранено в {outFile}");
    }

    public static void Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.WriteLine("Использование: dotnet run -- <input.svg> <команда> [параметры]");
            return;
        }
        string input = args[0];
        string command = args[1];
        var editor = new SvgEditor(input);

        try
        {
            switch (command)
            {
                case "list":
                    editor.ListLayers();
                    break;
                case "add-layer":
                {
                    string id = null;
                    var extra = new Dictionary<string, string>();
                    for (int i = 2; i < args.Length; i++)
                    {
                        if (args[i] == "--id" && i + 1 < args.Length)
                            id = args[++i];
                        else if (args[i] == "--attr" && i + 1 < args.Length)
                        {
                            var kv = args[++i].Split('=');
                            if (kv.Length == 2) extra[kv[0]] = kv[1];
                        }
                    }
                    editor.AddLayer(id, extra);
                    editor.Save(null);
                    break;
                }
                case "remove-layer":
                {
                    int index = -1;
                    for (int i = 2; i < args.Length; i++)
                    {
                        if (args[i] == "--index" && i + 1 < args.Length)
                            index = int.Parse(args[++i]);
                    }
                    if (index < 0) throw new Exception("Не указан --index");
                    editor.RemoveLayer(index);
                    editor.Save(null);
                    break;
                }
                case "move-layer":
                {
                    int index = -1;
                    string dir = "";
                    for (int i = 2; i < args.Length; i++)
                    {
                        if (args[i] == "--index" && i + 1 < args.Length)
                            index = int.Parse(args[++i]);
                        else if (args[i] == "--direction" && i + 1 < args.Length)
                            dir = args[++i];
                    }
                    if (index < 0 || string.IsNullOrEmpty(dir)) throw new Exception("Не указаны --index и --direction");
                    editor.MoveLayer(index, dir);
                    editor.Save(null);
                    break;
                }
                case "edit-layer":
                {
                    int index = -1;
                    string attr = "", value = "";
                    for (int i = 2; i < args.Length; i++)
                    {
                        if (args[i] == "--index" && i + 1 < args.Length)
                            index = int.Parse(args[++i]);
                        else if (args[i] == "--attr" && i + 1 < args.Length)
                            attr = args[++i];
                        else if (args[i] == "--value" && i + 1 < args.Length)
                            value = args[++i];
                    }
                    if (index < 0 || string.IsNullOrEmpty(attr) || string.IsNullOrEmpty(value))
                        throw new Exception("Не указаны --index, --attr, --value");
                    editor.EditLayer(index, attr, value);
                    editor.Save(null);
                    break;
                }
                case "save":
                {
                    string output = null;
                    for (int i = 2; i < args.Length; i++)
                    {
                        if (args[i] == "--output" && i + 1 < args.Length)
                            output = args[++i];
                    }
                    editor.Save(output);
                    break;
                }
                default:
                    Console.WriteLine($"Неизвестная команда: {command}");
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Ошибка: {ex.Message}");
        }
    }
}
