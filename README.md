# Star Battle Studio

i want to create an interactive puzzle editor for the puzzle Star Battle. The rules are: 

- each rows, column, region must contain one star. 

- No stars can be adjacent to each other not even diagonally adjacent.

The player wins when they place all the stars in the right position. 

For the user interface, 

- when the user clicks on a cell, it toggles between an “x”, a star or back to an empty cell. The “x” and the star are all white color. 

- Also, allow users to have the option to  automatically fill all the “x” after a star is placed. This option is on by default. 

- Create an undo button and a reset button. 

- Show a timer. And also add a button that allows users to reset the timer. 

- Create a guess mode that allows users to place “x” and “star” in different color of their choice. 

- Allow users to highlight any specific rows and/or columns. When those rows/columns are highlighted, a red arrow from the left/top is pointed towards that row/column.

- Allow users to highlight any region, this forces the perimeter of the region to have a zigzag pattern. 

- Allow users to point an arrow from one cell to another cell. 

- Allow users to save the current status of the grid as an image.

 

I’ve uploaded sample puzzle that was published by Netflix on May 5 2026. Please use it as an example. 

After this is implemented, I further want to showcase how to solve it by hand using the user interface as described above. That is, whenever a user made any progress in the grid, allow them to add details/explanation on the reasoning behind the steps. For example, “if we place any of the blue X as a star, it forces a star in the yellow region, which makes it impossible to place a star in the blue region.” Also do allow users the ability to state whether a certain step is a crux step in trivialising a puzzle or not.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://star-battle-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/11261b86-1693-4591-9fb6-de057e435a6f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
