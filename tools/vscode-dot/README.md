# DOT Language for VS Code

Syntax highlighting for the [DOT Protocol](https://github.com/dot-protocol/dot) language.

## Features

- Syntax highlighting for `.dot` files
- Keywords: `observe`, `agent`, `every`, `at`, `to`, `when`, `then`, `after`
- Functions: `.gate`, `.pulse`, `.chain`, `.mesh`, `.bloom`, `.fade`, `.forge`
- Types: `measure`, `state`, `event`, `claim`, `bond`
- Comment support (`#`)
- String and number highlighting
- Bracket matching and auto-closing

## Example

```dot
observe measure: temperature at sensor_7 = 82.3
  .gate(temperature > 80)
  .pulse(alert: "overheating")
  .chain(previous: last_observation)
  .forge(action: shutdown(reactor_3))

agent health_monitor {
  every 5 seconds {
    observe state: system_status
      .gate(status != "ok")
      .mesh(to: [ops_team])
  }
}
```

## License

Apache-2.0
