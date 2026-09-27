import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class VehicleScreen extends ConsumerStatefulWidget {
  const VehicleScreen({super.key});

  @override
  ConsumerState<VehicleScreen> createState() => _VehicleScreenState();
}

class _VehicleScreenState extends ConsumerState<VehicleScreen> {
  final _formKey = GlobalKey<FormState>();
  final _makeCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  final _plateCtrl = TextEditingController();
  String _vehicleType = 'berline';
  int _seats = 4;
  bool _saving = false;

  @override
  void dispose() {
    _makeCtrl.dispose();
    _modelCtrl.dispose();
    _plateCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final fn = FirebaseFunctions.instanceFor(region: 'europe-west1')
          .httpsCallable('saveVehicle');
      await fn.call({
        'make': _makeCtrl.text.trim(),
        'model': _modelCtrl.text.trim(),
        'plate': _plateCtrl.text.trim(),
        'vehicleType': _vehicleType,
        'seats': _seats,
      });
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Véhicule enregistré')),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Mon véhicule')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              'Informations du véhicule',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Ces informations sont visibles par les passagers.',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 24),

            // Marque
            TextFormField(
              controller: _makeCtrl,
              decoration: const InputDecoration(
                labelText: 'Marque',
                prefixIcon: Icon(Icons.directions_car_outlined),
              ),
              validator: (v) => v != null && v.trim().isNotEmpty
                  ? null
                  : 'Marque requise',
            ),
            const SizedBox(height: 16),

            // Modèle
            TextFormField(
              controller: _modelCtrl,
              decoration: const InputDecoration(
                labelText: 'Modèle',
                prefixIcon: Icon(Icons.car_repair_outlined),
              ),
              validator: (v) => v != null && v.trim().isNotEmpty
                  ? null
                  : 'Modèle requis',
            ),
            const SizedBox(height: 16),

            // Plaque
            TextFormField(
              controller: _plateCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Immatriculation',
                prefixIcon: Icon(Icons.confirmation_number_outlined),
                hintText: 'AB-123-CD',
              ),
              validator: (v) => v != null && v.trim().isNotEmpty
                  ? null
                  : 'Plaque requise',
            ),
            const SizedBox(height: 24),

            // Type de véhicule
            Text('Type de véhicule',
                style: theme.textTheme.labelLarge
                    ?.copyWith(color: colorScheme.onSurfaceVariant)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                ('berline', 'Berline'),
                ('suv', 'SUV'),
                ('citadine', 'Citadine'),
                ('monospace', 'Monospace'),
                ('break', 'Break'),
              ].map((e) {
                final selected = _vehicleType == e.$1;
                return ChoiceChip(
                  label: Text(e.$2),
                  selected: selected,
                  onSelected: (_) => setState(() => _vehicleType = e.$1),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // Nombre de places
            Text('Nombre de places (hors chauffeur)',
                style: theme.textTheme.labelLarge
                    ?.copyWith(color: colorScheme.onSurfaceVariant)),
            Slider(
              value: _seats.toDouble(),
              min: 1,
              max: 7,
              divisions: 6,
              label: '$_seats',
              onChanged: (v) => setState(() => _seats = v.round()),
            ),

            const SizedBox(height: 32),

            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52)),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Enregistrer le véhicule'),
            ),
          ],
        ),
      ),
    );
  }
}
