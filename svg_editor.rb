# svg_editor.rb
# Версия на Ruby с REXML, метапрограммированием

require 'rexml/document'
include REXML

class SvgEditor
  attr_reader :filename, :doc, :root, :layers

  def initialize(filename)
    @filename = filename
    @doc = Document.new(File.read(filename))
    @root = @doc.root
    load_layers
  end

  def load_layers
    @layers = []
    @root.each_element do |elem|
      if elem.name == 'g' || elem.attributes['data-layer']
        @layers << elem
      end
    end
  end

  def list_layers
    if @layers.empty?
      puts "Слои не найдены."
      return
    end
    @layers.each_with_index do |el, i|
      id = el.attributes['id'] || el.attributes['data-layer'] || 'без id'
      attrs = el.attributes.map { |k,v| "#{k}=\"#{v}\"" }.join(' ')
      puts "[#{i}] #{id} : #{attrs}"
    end
  end

  def add_layer(id, extra_attrs = {})
    new_group = Element.new('g')
    new_group.attributes['id'] = id if id
    extra_attrs.each { |k,v| new_group.attributes[k] = v }
    @root.add_element(new_group)
    @layers << new_group
    puts "Слой '#{id}' добавлен."
  end

  def remove_layer(index)
    if index < 0 || index >= @layers.size
      raise "Индекс вне диапазона"
    end
    el = @layers.delete_at(index)
    @root.delete_element(el)
    puts "Слой #{index} удалён."
  end

  def move_layer(index, direction)
    if index < 0 || index >= @layers.size
      raise "Индекс вне диапазона"
    end
    new_idx = direction == 'up' ? index - 1 : index + 1
    if new_idx < 0 || new_idx >= @layers.size
      raise "Невозможно переместить"
    end
    el1 = @layers[index]
    el2 = @layers[new_idx]
    # Перемещаем в DOM
    @root.delete_element(el1)
    @root.delete_element(el2)
    if index < new_idx
      @root.insert_before(el1, el2)
      @root.insert_before(el2, el1)
    else
      @root.insert_before(el2, el1)
      @root.insert_before(el1, el2)
    end
    @layers[index], @layers[new_idx] = @layers[new_idx], @layers[index]
    puts "Слой #{index} перемещён #{direction}."
  end

  def edit_layer(index, attr, value)
    if index < 0 || index >= @layers.size
      raise "Слой не найден"
    end
    @layers[index].attributes[attr] = value
    puts "Атрибут '#{attr}' слоя #{index} установлен в '#{value}'."
  end

  def save(output = nil)
    out = output || @filename
    File.write(out, @doc.to_s)
    puts "Сохранено в #{out}"
  end
end

# CLI
if ARGV.size < 2
  puts "Использование: ruby svg_editor.rb <input.svg> <команда> [параметры]"
  exit 1
end

input = ARGV[0]
command = ARGV[1]
editor = SvgEditor.new(input)

begin
  case command
  when 'list'
    editor.list_layers
  when 'add-layer'
    id = nil
    extra = {}
    i = 2
    while i < ARGV.size
      case ARGV[i]
      when '--id'
        id = ARGV[i+1]; i += 2
      when '--attr'
        kv = ARGV[i+1].split('=', 2)
        extra[kv[0]] = kv[1] if kv.size == 2
        i += 2
      else
        i += 1
      end
    end
    editor.add_layer(id, extra)
    editor.save
  when 'remove-layer'
    index = nil
    i = 2
    while i < ARGV.size
      if ARGV[i] == '--index'
        index = ARGV[i+1].to_i
        break
      end
      i += 1
    end
    raise "Не указан --index" if index.nil?
    editor.remove_layer(index)
    editor.save
  when 'move-layer'
    index = nil
    dir = nil
    i = 2
    while i < ARGV.size
      case ARGV[i]
      when '--index'
        index = ARGV[i+1].to_i; i += 2
      when '--direction'
        dir = ARGV[i+1]; i += 2
      else
        i += 1
      end
    end
    raise "Не указаны --index и --direction" if index.nil? || dir.nil?
    editor.move_layer(index, dir)
    editor.save
  when 'edit-layer'
    index = nil
    attr = nil
    value = nil
    i = 2
    while i < ARGV.size
      case ARGV[i]
      when '--index'
        index = ARGV[i+1].to_i; i += 2
      when '--attr'
        attr = ARGV[i+1]; i += 2
      when '--value'
        value = ARGV[i+1]; i += 2
      else
        i += 1
      end
    end
    raise "Не указаны --index, --attr, --value" if index.nil? || attr.nil? || value.nil?
    editor.edit_layer(index, attr, value)
    editor.save
  when 'save'
    output = nil
    i = 2
    while i < ARGV.size
      if ARGV[i] == '--output'
        output = ARGV[i+1]; break
      end
      i += 1
    end
    editor.save(output)
  else
    puts "Неизвестная команда: #{command}"
  end
rescue => e
  puts "Ошибка: #{e.message}"
  exit 1
end
