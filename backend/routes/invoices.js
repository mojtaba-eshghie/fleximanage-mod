// flexiWAN SD-WAN software - flexiEdge, flexiManage.
// For more information go to https://flexiwan.com
// Copyright (C) 2019  flexiWAN Ltd.

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('./cors');
const createError = require('http-errors');
const { verifyPermission } = require('../authenticate');
const flexibilling = require('../flexibilling');
const logger = require('../logging/logging')({ module: module.filename, type: 'req' });

const router = express.Router();
router.use(bodyParser.json());

// Retrieves the list of invoices and additional billing information
router.route('/')
  .options(cors.corsWithOptions, (req, res) => { res.sendStatus(200); })
  .get(cors.corsWithOptions, verifyPermission('billing', 'get'), async (req, res, next) => {
    const customerId = req.user.defaultAccount.billingCustomerId;

    if (!customerId) {
      logger.error('Account does not have link to billing system', { params: {} });
      return next(createError(500, 'Unknown account error'));
    }

    const invoices = await flexibilling.retrieveInvoices({ customer_id: customerId });

    const _invoices = invoices.map(value => {
      return {
        id: value.invoice.id,
        type: 'card',
        payment_method: 'card',
        amount: value.invoice.total,
        base_currency_code: value.invoice.base_currency_code,
        status: value.invoice.status,
        date: value.invoice.date
      };
    });

    for (let idx = 0; idx < _invoices.length; idx++) {
      _invoices[idx].download_url = await flexibilling.retrieveInvoiceDownloadLink({
        invoice_id: _invoices[idx].id
      });
    }

    const summary = await flexibilling.getMaxDevicesRegisteredSummmary(req.user.defaultAccount.id);

    const amount = await flexibilling.getCurrentUsage({ customer_id: customerId });
    const status = await flexibilling.getSubscriptionStatus({ customer_id: customerId });

    return res.status(200).json({ invoices: _invoices, summary, amount, subscription: status });
  });

// Default exports
module.exports = router;
