function ok(res, data, message = 'Success') {
  return res.status(200).json({ success: true, message, data });
}

function created(res, data, message = 'Created') {
  return res.status(201).json({ success: true, message, data });
}

function error(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

function paginate(res, data, total, page, limit) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}

module.exports = { ok, created, error, paginate };
