const restaurantService = require("./restaurant.service");

async function list(req, res) {
  try {
    const restaurants = await restaurantService.listRestaurants();
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor" });
  }
}

async function create(req, res) {
  try {
    const restaurant = await restaurantService.createRestaurant(req.body, req.user);

    res.status(201).json(restaurant);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Erro ao cadastrar restaurante:", error);
    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
}

module.exports = { list, create };
