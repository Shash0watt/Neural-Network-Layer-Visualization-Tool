# Neural-Network-Layer-Visualization-Tool

Because of a lack of tools to make quick and easy diagrams for NNN layer visualization I've made a simple tool to make it easier to make diagrams for resarch papers.

This tool is a single `index.html` file that uses Three.js to render an interactive 3D visualization of a neural network's layers.

## Features

* **Interactive 3D View**: Pan, rotate, and zoom the model using orbit controls.
* **Easy Customization**: Click the settings icon to open an edit panel.
* **Layer Editing**:
    * Add or remove individual layers.
    * Customize each layer's **Name**, **Height (H)**, **Width (W)**, **Channels (C)**, and **Color**.
* **Legend Editing**:
    * Add or remove new layer "types" to the legend.
    * Customize the color for each layer type.
* **General Settings**:
    * Adjust the **Font** (e.g., Times New Roman, Arial).
    * Change the **Label Font Size** and **Label Distance**.
    * Control the **Cube Gap** between layers.
    * Set the **Block Opacity**.

## Technology Stack

* **[Three.js](https://threejs.org/)**: For 3D rendering in the browser.
* **[Tailwind CSS](https://tailwindcss.com/)**: For styling the UI and edit panel.
* **HTML, CSS, & JavaScript**

## How to Use

1.  Clone or download the repository.
2.  Open the `index.html` file in any modern web browser.

## License

This project is licensed under the **GNU General Public License v3.0**. See the `LICENSE` file for more details.
