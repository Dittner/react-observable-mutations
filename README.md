# react-observable-mutations (ROM)

The ROM – an observable pattern based library. It can be used as an app state managment, that focuses on the mutations of observable objects: DomainEntities, ViewModels, Services, etc. But it's not possible to subscribe to changes of object's properties, lists or primitive values. In addition, subscriptions are registered manually, that makes the ROM more transparent and flexible than MobX.

## As an example, let's create a simple ToDo app
Our domain model has only a todo-task:

```ts
export class Task extends Observable {
  private readonly _text: string
  get text(): string {
    return this._text
  }

  private _isDone: boolean
  get isDone(): boolean {
    return this._isDone
  }

  constructor(text: string) {
    super('TodoTask')
    this._text = text
    this._isDone = false
  }

  done() {
    this._isDone = true
    this.mutated()
  }
}

```

The ViewModel contains a list of tasks:

```ts
export class TodoListVM extends Observable {
  tasks: Task[]

  constructor() {
    super('TodoVM')
    this.tasks = []
  }

  addTask(text: string) {
    this.tasks.push(new Task(text))
    this.mutated()
  }
}
```

The TodoListView will be rendered only after a new task is added.
The TaskView will be rendered after a new task is added or the task's status is changed.

```tsx
const todoListVM = new TodoListVM()

export const TodoListView = observer(() => {
  const vm = observe(todoListVM)
  return <div>
    <p>     Todo App     </p>
    <p>------------------</p>
    {vm.tasks.map(task => {
      return <TaskView key={task.text}
                       task={task}/>
    })}
    <p>------------------</p>
    <button onClick={() => { vm.addTask('Task ' + (vm.tasks.length + 1)) }}>Add Task</button>
  </div>
})

interface TaskViewProps {
  task: Task
}
export const TaskView = observer((props: TaskViewProps) => {
  const task = observe(props.task)
  return (
    <p onClick={() => { task.done() }}>
      {task.text + (task.isDone ? ': DONE' : ': IN PROGRESS')}
    </p>
  )
})

```


